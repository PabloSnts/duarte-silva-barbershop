-- PROPOSTAS PARA REVISAO. NAO EXECUTADO NA AUDITORIA.
-- Aprovar os blocos separadamente e implementar a integracao antes de usa-los.
-- Nao altera UUIDs, PKs, FKs ou dados existentes.

-- S1 / A07: futuros objetos de postgres nao devem herdar acesso publico.
-- Nao afeta objetos existentes. Outros criadores (supabase_admin) exigem
-- revisao pelo administrador da plataforma; nao alterar schemas gerenciados.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- S2 / A08: o GRANT de DML anterior nao removeu privilegios herdados.
-- Executar somente se nenhuma manutencao externa depender desses privilegios.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE
  public.settings, public.services, public.service_rules, public.vacations,
  public.clients, public.bookings, public.booking_services, public.blacklist,
  public.schedule_adjustments, public.adjustment_bookings, public.tv_state
FROM service_role;

-- S3 / A02: exigir ao menos um item e duracao total consistente no COMMIT.
-- PRE-CONDICAO: diagnosticar e resolver reservas sem itens ou com soma divergente.
-- Reservas e itens terao de ser gravados em UMA transacao; RESTs separados falharao.
-- Funcao INVOKER, sem privilegios elevados, com referencias qualificadas.
CREATE FUNCTION public.check_booking_items_integrity()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  target_ids text[];
  target_id text;
  expected_minutes integer;
  item_count bigint;
  actual_minutes bigint;
BEGIN
  IF TG_TABLE_NAME = 'bookings' THEN
    IF TG_OP = 'INSERT' THEN target_ids := ARRAY[NEW.id];
    ELSE target_ids := ARRAY[OLD.id, NEW.id]; END IF;
  ELSE
    IF TG_OP = 'INSERT' THEN target_ids := ARRAY[NEW.booking_id];
    ELSIF TG_OP = 'DELETE' THEN target_ids := ARRAY[OLD.booking_id];
    ELSE target_ids := ARRAY[OLD.booking_id, NEW.booking_id]; END IF;
  END IF;
  FOR target_id IN SELECT DISTINCT x FROM unnest(target_ids) AS u(x) ORDER BY x LOOP
    SELECT b.duration_minutes INTO expected_minutes
      FROM public.bookings b WHERE b.id = target_id FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF; -- parent deleted with CASCADE
    SELECT count(*), coalesce(sum(s.duration_minutes),0)
      INTO item_count, actual_minutes
      FROM public.booking_services s WHERE s.booking_id = target_id;
    IF item_count = 0 OR actual_minutes <> expected_minutes THEN
      RAISE EXCEPTION 'Reserva sem servicos ou duracao divergente'
        USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.check_booking_items_integrity()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_booking_items_integrity() TO service_role;
CREATE CONSTRAINT TRIGGER bookings_items_integrity
AFTER INSERT OR UPDATE ON public.bookings
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION public.check_booking_items_integrity();
CREATE CONSTRAINT TRIGGER booking_services_integrity
AFTER INSERT OR UPDATE OR DELETE ON public.booking_services
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION public.check_booking_items_integrity();

-- S4 / A06: carimbo de alteracao em entidades mutaveis.
-- Nao substitui um cursor global, Realtime, controle de concorrencia ou historico.
-- Registros preexistentes receberao o instante da migracao, nao a data historica real.
CREATE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_updated_at() TO service_role;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['settings','services','service_rules','vacations',
    'clients','bookings','booking_services','blacklist','schedule_adjustments',
    'adjustment_bookings','tv_state'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now()',t);
    EXECUTE format('CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()',t);
  END LOOP;
END;
$$;

-- S5 / A14: rejeitar NULL dentro dos arrays de dias.
-- Duplicatas tambem devem ser normalizadas no servidor; nao corrigir dados em massa.
ALTER TABLE public.settings ADD CONSTRAINT settings_work_days_no_nulls
  CHECK (array_position(work_days, NULL::smallint) IS NULL) NOT VALID;
ALTER TABLE public.service_rules ADD CONSTRAINT service_rules_days_no_nulls
  CHECK (array_position(days, NULL::smallint) IS NULL) NOT VALID;
-- Validar somente apos consulta de dados:
ALTER TABLE public.settings VALIDATE CONSTRAINT settings_work_days_no_nulls;
ALTER TABLE public.service_rules VALIDATE CONSTRAINT service_rules_days_no_nulls;

-- A01, A03-A05, A09-A13, A15-A16:
-- Correcoes principalmente de aplicacao, contrato, testes ou configuracao.
-- Nao ha SQL isolado que resolva esses itens.
-- NAO criar policy USING(true); NAO conceder acesso direto ao anon.
-- NAO converter IDs text em uuid por cast: ha IDs legitimos como corte e barba.
-- NAO mudar 45 para 60 sem decidir a regra comercial de Pigmentacao.

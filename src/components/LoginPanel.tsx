import { useState } from "react";
import { getAuthClient } from "@/lib/remote";
import { adminEmail, invalidLoginMessage } from "@/lib/admin-login";
import { exportBrowserBackup, refreshStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginPanel({ error }: { error?: string | undefined }) {
  const [username,setUsername] = useState("");
  const [password,setPassword] = useState("");
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  return <main className="grid min-h-dvh place-items-center bg-background p-4">
    <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
      <img src="/duarte-silva-logo.webp" alt="Duarte & Silva Barbearia" className="mx-auto h-16 w-40 object-contain" />
      <h1 className="mt-5 text-center text-2xl font-bold uppercase">Acesso administrativo</h1>
      <p className="mt-2 text-sm text-muted-foreground">Entre com seu usuário e senha para acessar a agenda.</p>
      <form className="mt-5 grid gap-3" onSubmit={async(e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true); setMessage("");
        try {
          const email = adminEmail(username);
          if (!email) { setMessage(invalidLoginMessage); return; }
          const auth = getAuthClient().auth;
          const result = await auth.signInWithPassword({email,password});
          if (result.error || !result.data.session) setMessage(invalidLoginMessage);
          else await refreshStore(true);
        } catch { setMessage("Não foi possível conectar. Tente novamente."); }
        finally { setPassword(""); setBusy(false); }
      }}>
        <label className="grid gap-1 text-sm">Usuário<Input type="text" name="username" required maxLength={80} disabled={busy} value={username} autoComplete="username" autoCapitalize="none" spellCheck={false} onChange={(e)=>setUsername(e.target.value)} /></label>
        <label className="grid gap-1 text-sm">Senha<Input type="password" name="password" required disabled={busy} value={password} autoComplete="current-password" onChange={(e)=>setPassword(e.target.value)} /></label>
        <Button disabled={busy} type="submit">{busy ? "Aguarde…" : "Entrar"}</Button>
      </form>
      {(message || error) && <p role="status" className="mt-3 text-sm text-warning">{message || error}</p>}
      <div className="mt-4 grid gap-2 text-sm">
        <button type="button" className="text-muted-foreground underline" onClick={async()=>{await getAuthClient().auth.signOut();await refreshStore(true);}}>Sair da conta atual</button>
        <button type="button" className="text-muted-foreground underline" onClick={exportBrowserBackup}>Exportar dados antigos deste aparelho</button>
        <button type="button" className="text-muted-foreground underline" onClick={()=>void refreshStore(true)}>Tentar conectar novamente</button>
      </div>
    </section>
  </main>;
}

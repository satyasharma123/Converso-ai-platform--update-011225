import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Exchange code for session (PKCE flow)
        const { data, error } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        );

        if (error) {
          console.error("Auth callback error:", error);
          navigate("/login?error=auth_callback_failed");
          return;
        }

        if (data?.session) {
          // Successfully authenticated - redirect to inbox
          navigate("/inbox/email");
        } else {
          // No session created - redirect to login
          navigate("/login");
        }
      } catch (err) {
        console.error("Auth callback exception:", err);
        navigate("/login?error=auth_callback_exception");
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <h2 className="text-xl font-semibold mb-2">Signing you in…</h2>
        <p className="text-muted-foreground">Please wait.</p>
      </div>
    </div>
  );
}

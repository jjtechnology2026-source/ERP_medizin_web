import { useState } from "react";
import { useAuth } from "@/modules/core/hooks/useAuth";
import { authService } from "@/modules/auth/api/auth.services";

export const useLoginForm = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const { login } = useAuth();

  const togglePassword = () => setShowPassword(!showPassword);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
      Promise.race([
        p,
        new Promise<T>((_, reject) =>
          setTimeout(
            () => reject(new Error("Tiempo de espera agotado al conectar. Reintentá.")),
            ms,
          ),
        ),
      ]);

    try {
      const data = await withTimeout(authService.login({ username, password }), 25000);

      if (data.success === false) {
        throw new Error(data.message || "Credenciales inválidas");
      }

      await withTimeout(
        login({
          isDirectLogin: "true",
          userData: JSON.stringify(data),
        }),
        15000,
      );

      try {
        localStorage.setItem("startedSession", "true");
      } catch (err) {
        console.warn("No se pudo guardar startedSession en localStorage", err);
      }
      setTimeout(() => window.location.assign("/panel"), 100);
    } catch (err: any) {
      setError(err.message || "Credenciales incorrectas o error de servidor");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    username,
    setUsername,
    password,
    setPassword,
    showPassword,
    togglePassword,
    isLoading,
    error,
    handleLogin,
  };
};

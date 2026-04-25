import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/modules/core/hooks/useAuth";

export const useLoginForm = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const { login } = useAuth();
  const router = useRouter();

  const togglePassword = () => setShowPassword(!showPassword);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await login({ username, password });
      try {
        localStorage.setItem("startedSession", "true");
      } catch (error) {
        console.warn("No se pudo guardar startedSession en localStorage", error);
      }
      router.push("/panel");
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

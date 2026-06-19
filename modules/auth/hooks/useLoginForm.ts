import { useState } from "react";
import { useAuth } from "@/modules/core/hooks/useAuth";
import { authService } from "@/modules/auth/api/auth.services";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";

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

    try {
      const data = await authService.login({ username, password });
      
      if (data.success === false) {
        throw new Error(data.message || "Credenciales inválidas");
      }

      // Save medicines to localStorage for persistence across page reloads
      const medicines = data.medicines || data.medications || [];
      if (Array.isArray(medicines) && medicines.length) {
        useAuthStore.getState().setMedicinesCatalog(medicines);
        try {
          localStorage.setItem("medicines-catalog", JSON.stringify(medicines));
        } catch (e) {}
      }

      await login({
        isDirectLogin: "true",
        userData: JSON.stringify(data),
      });

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

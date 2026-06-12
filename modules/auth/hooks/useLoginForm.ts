import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

  const togglePassword = () => setShowPassword(!showPassword);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // 1. Call login directly on the client side to get the full API response
      const data = await authService.login({ username, password });
      
      if (data.success === false) {
        throw new Error(data.message || "Credenciales inválidas");
      }

      // 2. Capture the medicines catalog and save it to Zustand useAuthStore
      if (data.medicines && Array.isArray(data.medicines)) {
        useAuthStore.getState().setMedicinesCatalog(data.medicines);
        console.log(`Successfully saved ${data.medicines.length} medicines into Zustand catalog store.`);
      } else {
        console.warn("No medicines array found in the login response.");
      }

      // 3. Complete login session using next-auth with the direct login feature
      await login({
        isDirectLogin: "true",
        userData: JSON.stringify(data),
      });

      try {
        localStorage.setItem("startedSession", "true");
      } catch (err) {
        console.warn("No se pudo guardar startedSession en localStorage", err);
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

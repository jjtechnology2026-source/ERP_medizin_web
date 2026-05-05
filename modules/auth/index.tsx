"use client";
import React from "react";
import { FaEye, FaEyeSlash, FaArrowRight } from "react-icons/fa";
import Link from "next/link";
import LoadingOverlay from "@/modules/auth/components/LoadingOverlay";
import LoginWrapper from "@/modules/auth/components/LoginWrapper";
import { useLoginForm } from "./hooks/useLoginForm";
import { useRouter } from "next/navigation";

import { useSession } from "next-auth/react";
import { useAuth } from "@/modules/core/hooks/useAuth";

export default function LoginForm() {
  const { status, data: session } = useSession();
  const { logout } = useAuth();
  const { username, setUsername, password, setPassword, showPassword, togglePassword, isLoading, error: loginError, handleLogin } = useLoginForm();
  const router = useRouter();
  const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === "true";

  // Efecto para limpiar sesión si venimos de un error de refresco
  React.useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("error") === "SessionExpired") {
      logout();
    }
  }, [logout]);

  // Si el estado es autenticado pero tenemos un error de refresco,
  // permitimos que se vea el formulario para re-autenticar
  const hasSessionError = (session as any)?.error === "RefreshAccessTokenError";

  // Si ya estamos autenticados y no hay error, mostramos el overlay a pantalla completa
  if (status === "authenticated" && !hasSessionError) {
    return <LoadingOverlay message="¡Bienvenido de nuevo!" subtext="Entrando al panel de control..." />;
  }

  const handleBypassLocal = () => {
    localStorage.setItem("startedSession", "true");
    router.push("/panel");
  };

  return (
    <LoginWrapper>
      <div className="w-full relative">
        {(status === "loading" || isLoading) && (
          <LoadingOverlay 
            message={isLoading ? "Verificando credenciales..." : "Cargando..."} 
          />
        )}
        
        <div className="text-center mb-10">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Iniciar sesión</h2>
          <p className="text-gray-400 text-sm font-bold mt-1">Ingresa tus credenciales para continuar</p>
        </div>

        {loginError && <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-2xl text-center font-medium">{loginError}</div>}

        <form className="space-y-6" onSubmit={handleLogin}>
          {/* Input Usuario */}
          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Correo o usuario</label>
            <input
              type="text"
              placeholder="usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-4 text-black bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-semibold"
            />
          </div>

          {/* Input Password */}
          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-black w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-semibold"
              />
              <button
                type="button"
                onClick={togglePassword}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors"
              >
                {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4 pt-2">
            {/* Botón Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#005eff] text-white font-black py-4 rounded-2xl shadow-[0_10px_30px_rgba(0,94,255,0.3)] hover:bg-blue-600 transition-all text-sm disabled:opacity-50 active:scale-[0.98]"
            >
              {isLoading ? "Iniciando sesión..." : "Acceder al Panel"}
            </button>

            {/* Botón Bypass (Solo en Test Mode) */}
            {isTestMode && (
              <button
                type="button"
                onClick={handleBypassLocal}
                className="w-full bg-emerald-50 text-emerald-600 font-black py-4 rounded-2xl border border-emerald-100 hover:bg-emerald-100 transition-all text-sm flex items-center justify-center gap-2 group"
              >
                Ver interfaz (Bypass) <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
              </button>
            )}
          </div>

          <p className="text-center text-xs text-slate-400 pt-6 font-bold">
            ¿No tienes una cuenta?{" "}
            <Link href="/register" className="text-[#005eff] font-black hover:underline underline-offset-4">
              Regístrate ahora
            </Link>
          </p>
        </form>
      </div>
    </LoginWrapper>
  );
}

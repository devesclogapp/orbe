import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, act, renderHook } from "@testing-library/react";
import { UxLabThemeProvider, useUxLabTheme } from "@/components/ux-lab/UxLabThemeContext";

describe("FUNDAÇÃO GLOBAL DE TEMA LIGHT/DARK — UX LAB", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    vi.restoreAllMocks();
  });

  it("1. Inicializa por padrão com 'light' e sem classe dark quando localStorage está vazio", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UxLabThemeProvider>{children}</UxLabThemeProvider>
    );

    const { result } = renderHook(() => useUxLabTheme(), { wrapper });

    expect(result.current.theme).toBe("light");
    expect(result.current.isDark).toBe(false);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("2. Inicializa com 'dark' quando localStorage possui 'esc-log-theme' = 'dark'", () => {
    localStorage.setItem("esc-log-theme", "dark");

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UxLabThemeProvider>{children}</UxLabThemeProvider>
    );

    const { result } = renderHook(() => useUxLabTheme(), { wrapper });

    expect(result.current.theme).toBe("dark");
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("3. toggleTheme alterna imediatamente entre Light e Dark, persistindo no localStorage", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UxLabThemeProvider>{children}</UxLabThemeProvider>
    );

    const { result } = renderHook(() => useUxLabTheme(), { wrapper });

    expect(result.current.theme).toBe("light");

    // Alterna para dark
    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe("dark");
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("esc-log-theme")).toBe("dark");

    // Alterna de volta para light
    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe("light");
    expect(result.current.isDark).toBe(false);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("esc-log-theme")).toBe("light");
  });

  it("4. setTheme define explicitamente o tema desejado", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UxLabThemeProvider>{children}</UxLabThemeProvider>
    );

    const { result } = renderHook(() => useUxLabTheme(), { wrapper });

    act(() => {
      result.current.setTheme("dark");
    });

    expect(result.current.theme).toBe("dark");
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("esc-log-theme")).toBe("dark");
  });

  it("5. useUxLabTheme provê fallback defensivo sem quebrar caso executado fora do Provider", () => {
    const { result } = renderHook(() => useUxLabTheme());

    expect(result.current).toBeDefined();
    expect(["light", "dark"]).toContain(result.current.theme);
    expect(typeof result.current.toggleTheme).toBe("function");
    expect(typeof result.current.setTheme).toBe("function");
  });
});

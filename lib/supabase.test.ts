import { describe, expect, it } from "vitest";
import { ehSupabaseLocal } from "./supabase";

/**
 * Trava do autologin de desenvolvimento. O risco que ela existe para conter é
 * a flag NEXT_PUBLIC_DEV_AUTOLOGIN vazar para um build que aponta para o
 * projeto do Mateus: ali o autologin tentaria entrar na base que guarda a
 * declaração dele. A URL é a última barreira, então ela é testada sozinha.
 */
describe("ehSupabaseLocal", () => {
  it("aceita o stack em Docker da própria máquina", () => {
    expect(ehSupabaseLocal("http://127.0.0.1:54331")).toBe(true);
    expect(ehSupabaseLocal("http://localhost:54331")).toBe(true);
    expect(ehSupabaseLocal("http://[::1]:54331")).toBe(true);
  });

  it("recusa o projeto remoto", () => {
    expect(ehSupabaseLocal("https://holgxocpmffwrlhwfqjn.supabase.co")).toBe(
      false,
    );
  });

  it("recusa host que apenas se parece com local", () => {
    expect(ehSupabaseLocal("https://127.0.0.1.exemplo.com")).toBe(false);
    expect(ehSupabaseLocal("https://localhost.exemplo.com")).toBe(false);
    // Credencial no userinfo: o host real é o que vem depois do @.
    expect(ehSupabaseLocal("https://localhost@exemplo.com")).toBe(false);
  });

  it("recusa ausência de URL e valor inválido", () => {
    expect(ehSupabaseLocal(undefined)).toBe(false);
    expect(ehSupabaseLocal("")).toBe(false);
    expect(ehSupabaseLocal("nao-e-url")).toBe(false);
  });

  it("recusa esquema que não é http(s)", () => {
    expect(ehSupabaseLocal("file://127.0.0.1")).toBe(false);
    expect(ehSupabaseLocal("javascript:alert(1)")).toBe(false);
  });
});

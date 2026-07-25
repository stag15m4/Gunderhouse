"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { str } from "@/lib/forms";

export async function signInWithPassword(form: FormData) {
  const email = str(form, "email");
  const password = str(form, "password");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/homes",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=Email+or+password+is+incorrect.");
    }
    // signIn signals a successful redirect by throwing; let that through.
    throw error;
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

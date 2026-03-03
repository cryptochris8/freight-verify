"use client";

import { useState, useRef, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Loader2 } from "lucide-react";

interface OtpVerifyFormProps {
  loadId: string;
}

export function OtpVerifyForm({ loadId }: OtpVerifyFormProps) {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function handleDigitChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newDigits = [...digits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] ?? "";
    }
    setDigits(newDigits);
    if (pasted.length === 6) {
      inputRefs.current[5]?.focus();
    }
  }

  function handleVerify() {
    const otp = digits.join("");
    if (otp.length !== 6) {
      setError("Please enter all 6 digits");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/verification/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ loadId, otp }),
        });
        const result = await response.json();

        if (result.success) {
          setSuccess(true);
          window.location.href = "/verify/" + loadId + "/photos";
        } else {
          setError(result.message);
          setAttemptsRemaining(result.attemptsRemaining ?? null);
          setDigits(["", "", "", "", "", ""]);
          inputRefs.current[0]?.focus();
        }
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }

  if (success) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-2">
          <ShieldCheck className="h-12 w-12 text-green-600 mx-auto" />
          <p className="text-lg font-semibold text-green-600">Pickup Verified</p>
          <p className="text-sm text-muted-foreground">Redirecting to photo capture...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center text-lg">Enter Verification Code</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          Enter the 6-digit code provided by the driver
        </p>

        <div className="flex justify-center gap-2" onPaste={handlePaste}>
          {digits.map((digit, i) => (
            <Input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-12 h-14 text-center text-xl font-bold"
              autoFocus={i === 0}
            />
          ))}
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive text-center">
            {error}
          </div>
        )}

        {attemptsRemaining !== null && attemptsRemaining > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            {attemptsRemaining} attempt(s) remaining
          </p>
        )}

        <Button onClick={handleVerify} disabled={isPending} className="w-full" size="lg">
          {isPending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying...</>
          ) : (
            "Verify"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

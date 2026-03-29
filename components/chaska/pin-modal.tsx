"use client";

import { useState, useEffect } from "react";
import { Delete, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PinModalProps {
  title?: string;
  subtitle?: string;
  correctPin: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const LOCKOUT_SECONDS = 30;
const MAX_ATTEMPTS = 3;

export default function PinModal({
  title = "Enter PIN",
  subtitle = "This area is protected",
  correctPin,
  onSuccess,
  onCancel,
}: PinModalProps) {
  const [digits, setDigits] = useState<string>("");
  const [shake, setShake] = useState(false);
  const [error, setError] = useState<string>("");
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Countdown timer for lockout
  useEffect(() => {
    if (!lockedUntil) return;
    const interval = setInterval(() => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockedUntil(null);
        setAttempts(0);
        setCountdown(0);
        setError("");
      } else {
        setCountdown(remaining);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;

  const handleDigit = (d: string) => {
    if (isLocked || digits.length >= 4) return;
    const next = digits + d;
    setDigits(next);
    setError("");

    if (next.length === 4) {
      if (next === correctPin) {
        onSuccess();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setDigits("");
        }, 500);

        if (newAttempts >= MAX_ATTEMPTS) {
          const until = Date.now() + LOCKOUT_SECONDS * 1000;
          setLockedUntil(until);
          setError(`Too many attempts. Try again in ${LOCKOUT_SECONDS}s.`);
        } else {
          setError(`Incorrect PIN. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts === 1 ? "" : "s"} remaining.`);
        }
      }
    }
  };

  const handleDelete = () => {
    if (isLocked) return;
    setDigits((prev) => prev.slice(0, -1));
    setError("");
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-xs bg-card rounded-3xl shadow-2xl border border-border overflow-hidden">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 text-center">
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-muted active:scale-90 transition-transform"
            aria-label="Cancel"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
          <p className="text-xs font-bold tracking-[0.3em] text-primary uppercase mb-1">
            🔒 Protected
          </p>
          <h2 className="text-xl font-extrabold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>

        {/* PIN dots */}
        <div className="flex justify-center gap-4 py-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                "w-4 h-4 rounded-full border-2 transition-all duration-150",
                shake ? "animate-bounce border-destructive" : "",
                digits.length > i
                  ? "bg-primary border-primary scale-110"
                  : "bg-transparent border-border"
              )}
            />
          ))}
        </div>

        {/* Error / lockout message */}
        <div className="min-h-[24px] px-6 text-center">
          {isLocked ? (
            <p className="text-sm font-semibold text-destructive">
              Try again in {countdown}s
            </p>
          ) : error ? (
            <p className="text-sm font-semibold text-destructive">{error}</p>
          ) : null}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-px bg-border mt-4 border-t border-border">
          {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((key, idx) => {
            if (key === "") return <div key={idx} className="bg-card" />;
            return (
              <button
                key={idx}
                onClick={() => key === "⌫" ? handleDelete() : handleDigit(key)}
                disabled={isLocked}
                className={cn(
                  "bg-card py-5 text-xl font-bold text-foreground",
                  "active:bg-muted transition-colors duration-100",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                  key === "⌫" && "text-muted-foreground"
                )}
                aria-label={key === "⌫" ? "Delete" : `Digit ${key}`}
              >
                {key === "⌫" ? <Delete className="w-5 h-5 mx-auto" /> : key}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";

interface ExamTimerProps {
  durationMinutes: number;
  onExpire: () => void;
}

export default function ExamTimer({ durationMinutes, onExpire }: ExamTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);
  const [hasExpired, setHasExpired] = useState(false);

  const handleExpire = useCallback(() => {
    if (!hasExpired) {
      setHasExpired(true);
      onExpire();
    }
  }, [hasExpired, onExpire]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      handleExpire();
      return;
    }
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          handleExpire();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft, handleExpire]);

  const hours   = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;

  const isWarning  = secondsLeft <= 300 && secondsLeft > 60;
  const isDangerous = secondsLeft <= 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-lg font-bold transition-colors ${
        isDangerous
          ? "bg-red-100 text-red-700 border-2 border-red-400 animate-pulse"
          : isWarning
          ? "bg-yellow-100 text-yellow-700 border-2 border-yellow-400"
          : "bg-blue-50 text-blue-700 border-2 border-blue-200"
      }`}
    >
      <span className="text-xl">⏱</span>
      <span>
        {hours > 0 && `${pad(hours)}:`}
        {pad(minutes)}:{pad(seconds)}
      </span>
    </div>
  );
}

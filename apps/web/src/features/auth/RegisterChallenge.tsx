import "altcha";
import "altcha/i18n/en";
import "altcha/i18n/zh-cn";
import { useEffect, useRef } from "react";

/** 注册前的计算题。算完把 payload 交给表单，没算完不能提交。 */
export function RegisterChallenge({
  language,
  onPayload,
}: {
  language: string;
  onPayload: (payload: string | undefined) => void;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const onChange = (event: Event) => {
      const { detail } = event as CustomEvent<{ payload?: string | null; state?: string }>;
      const { payload, state } = detail ?? {};
      onPayload(state === "verified" && payload ? payload : undefined);
    };

    element.addEventListener("statechange", onChange);
    return () => {
      element.removeEventListener("statechange", onChange);
    };
  }, [onPayload]);

  return (
    <altcha-widget
      ref={ref}
      auto="off"
      challenge="/api/auth/register-challenge"
      language={language.startsWith("zh") ? "zh-cn" : "en"}
      style={{ display: "block", marginBottom: 16 }}
      type="checkbox"
      workers="2"
    />
  );
}

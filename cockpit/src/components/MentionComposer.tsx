import { useEffect, useMemo, useRef, useState } from "react";
import { AtSign, Send } from "lucide-react";
import clsx from "clsx";
import type { Agent } from "@/lib/demo";
import { AgentAvatar } from "./AgentAvatar";

/**
 * Note composer with @-mention autocomplete for agents.
 */
export function MentionComposer({
  agents,
  placeholder = "Write a note… Type @ to tag an agent",
  onSend,
  disabled,
}: {
  agents: Agent[];
  placeholder?: string;
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const suggestions = useMemo(() => {
    const q = mentionQuery.toLowerCase();
    return agents
      .filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.role.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [agents, mentionQuery]);

  useEffect(() => {
    setHighlight(0);
  }, [mentionQuery, mentionOpen]);

  function detectMention(value: string, cursor: number) {
    const before = value.slice(0, cursor);
    const at = before.lastIndexOf("@");
    if (at < 0) {
      setMentionOpen(false);
      return;
    }
    const fragment = before.slice(at + 1);
    // Space or newline before @ is ok; mid-word @ is not a mention start
    if (at > 0 && /[\w]/.test(before[at - 1]!)) {
      setMentionOpen(false);
      return;
    }
    if (/[\s\n]/.test(fragment)) {
      setMentionOpen(false);
      return;
    }
    setMentionOpen(true);
    setMentionQuery(fragment);
  }

  function insertMention(agent: Agent) {
    const el = inputRef.current;
    if (!el) return;
    const cursor = el.selectionStart ?? draft.length;
    const before = draft.slice(0, cursor);
    const after = draft.slice(cursor);
    const at = before.lastIndexOf("@");
    if (at < 0) return;
    const next = `${before.slice(0, at)}@${agent.name} ${after}`;
    setDraft(next);
    setMentionOpen(false);
    setMentionQuery("");
    requestAnimationFrame(() => {
      const pos = at + agent.name.length + 2;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function submit() {
    const t = draft.trim();
    if (!t || disabled) return;
    onSend(t);
    setDraft("");
    setMentionOpen(false);
  }

  return (
    <div className="relative">
      {mentionOpen && suggestions.length > 0 && (
        <ul
          className="absolute bottom-full left-0 right-0 z-20 mb-2 max-h-56 overflow-y-auto rounded-2xl border border-line bg-paper py-1 shadow-xl"
          role="listbox"
        >
          {suggestions.map((agent, i) => (
            <li key={agent.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlight}
                className={clsx(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-cream",
                  i === highlight && "bg-cream",
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(agent);
                }}
              >
                <AgentAvatar agent={agent} size="sm" />
                <div className="min-w-0">
                  <div className="font-semibold text-sm">@{agent.name}</div>
                  <div className="truncate text-xs text-mute">{agent.role}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <textarea
            ref={inputRef}
            value={draft}
            rows={2}
            disabled={disabled}
            placeholder={placeholder}
            className="w-full resize-none rounded-2xl border border-line bg-paper px-4 py-3 pr-10 text-sm shadow-sm outline-none focus:border-honey disabled:opacity-50"
            onChange={(e) => {
              const v = e.target.value;
              setDraft(v);
              detectMention(v, e.target.selectionStart ?? v.length);
            }}
            onKeyDown={(e) => {
              if (mentionOpen && suggestions.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlight((h) => (h + 1) % suggestions.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlight(
                    (h) => (h - 1 + suggestions.length) % suggestions.length,
                  );
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  const pick = suggestions[highlight];
                  if (pick) insertMention(pick);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setMentionOpen(false);
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            onClick={(e) => {
              const t = e.currentTarget;
              detectMention(draft, t.selectionStart ?? draft.length);
            }}
          />
          <button
            type="button"
            title="Tag an agent"
            className="absolute right-2 top-2 rounded-lg p-1.5 text-mute hover:bg-cream hover:text-honey-deep"
            onClick={() => {
              const el = inputRef.current;
              if (!el) return;
              const start = el.selectionStart ?? draft.length;
              const next = `${draft.slice(0, start)}@${draft.slice(start)}`;
              setDraft(next);
              setMentionOpen(true);
              setMentionQuery("");
              requestAnimationFrame(() => {
                el.focus();
                el.setSelectionRange(start + 1, start + 1);
              });
            }}
          >
            <AtSign className="size-4" />
          </button>
        </div>
        <button
          type="button"
          disabled={disabled || !draft.trim()}
          onClick={submit}
          className="inline-flex shrink-0 items-center gap-2 self-end rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-paper disabled:opacity-40"
        >
          <Send className="size-4" />
          Send
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-mute">
        Tip: type <kbd className="rounded bg-cream-2 px-1 font-mono">@</kbd> to
        tag an agent — they join this work and start on the task.
      </p>
    </div>
  );
}

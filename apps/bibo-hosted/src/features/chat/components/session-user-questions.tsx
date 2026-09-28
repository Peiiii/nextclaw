import { useEffect, useState } from "react";
import { ArrowRight, CircleHelp, MessageCircleQuestion, Quote, X } from "lucide-react";
import { Button, Tooltip } from "@nextclaw/personal-agent-ui";
import type { BiboQuestion, BiboQuestionReference } from "@nextclaw/bibo-client";
import { biboCopy as copy } from "@/shared/configs/bibo-copy.config";

export function QuestionTags({ questions, onOpen }: { questions: BiboQuestion[]; onOpen: (id: string) => void }) {
  if (!questions.length) return null;
  return <div className="bibo-question-tags">{questions.map((question) => question.status === "pending"
    ? <button key={question.id} type="button" className="bibo-question-tag" onClick={() => onOpen(question.id)}
        aria-label={`${copy.questionOpen}：${question.title}`}><MessageCircleQuestion size={14} aria-hidden="true" /><span>{question.title}</span></button>
    : <span key={question.id} className="bibo-question-tag is-settled" title={question.title}>
        <MessageCircleQuestion size={14} aria-hidden="true" /><span>{question.title}</span><small>{question.status === "answered" ? copy.questionAnswered : copy.questionSkipped}</small>
      </span>)}</div>;
}

export function QuestionReference({ reference }: { reference: BiboQuestionReference }) {
  return <div className="bibo-question-reference" title={`${copy.questionReference}：${reference.title}`}>
    <Quote size={14} aria-hidden="true" /><span>{reference.title}</span>
  </div>;
}

export function QuestionPanel({ question, busy, onClose, onAnswer, onDismiss }: {
  question: BiboQuestion;
  busy: boolean;
  onClose: () => void;
  onAnswer: (answer: string) => void;
  onDismiss: () => void;
}) {
  const [custom, setCustom] = useState("");
  const [helpOpen, setHelpOpen] = useState<string | null>(null);
  useEffect(() => { setCustom(""); setHelpOpen(null); }, [question.id]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { if (helpOpen) setHelpOpen(null); else onClose(); } };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [helpOpen, onClose]);
  const options = question.options ?? [];
  return <section className="bibo-question-panel" aria-label={copy.questionLabel}>
    <div className="bibo-question-heading"><span><MessageCircleQuestion size={17} aria-hidden="true" />{copy.questionLabel}</span>
      <button type="button" className="bibo-question-close" onClick={onClose} aria-label={copy.questionClose} title={copy.questionClose}><X size={17} /></button>
    </div>
    <h2>{question.title}</h2>
    <div className="bibo-question-options">{options.map((option, index) => {
      const description = question.optionDescriptions?.[option];
      return <div key={option} className={`bibo-question-option${question.recommendedOption === option ? " is-recommended" : ""}`}>
        <button type="button" className="bibo-question-choice" disabled={busy} onClick={() => onAnswer(option)}>
          <span className="bibo-question-index">{String.fromCharCode(65 + index)}</span><span className="bibo-question-choice-text">{option}</span>
          {question.recommendedOption === option && <small>{copy.questionRecommended}</small>}
          <ArrowRight className="bibo-question-choice-arrow" size={16} aria-hidden="true" />
        </button>
        {description && <span className="bibo-question-help-wrap"><Tooltip label={description} side="top">
          <button type="button" className="bibo-question-help" aria-label={`${option}：${description}`} aria-expanded={helpOpen === option}
            onClick={() => setHelpOpen(helpOpen === option ? null : option)}><CircleHelp size={15} /></button>
        </Tooltip>{helpOpen === option && <span className="bibo-question-help-content" role="tooltip">{description}</span>}</span>}
      </div>;
    })}</div>
    <div className="bibo-question-footer"><label className="bibo-question-custom">
      <span className="bibo-question-index">{String.fromCharCode(65 + options.length)}</span>
      <input value={custom} disabled={busy} maxLength={4000} placeholder={copy.questionCustom} aria-label={copy.questionCustom}
        onChange={(event) => setCustom(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && custom.trim()) onAnswer(custom.trim()); }} />
    </label><Button tone="text" disabled={busy} onClick={onDismiss}>{copy.questionSkip}</Button>
      <Button disabled={busy || !custom.trim()} onClick={() => onAnswer(custom.trim())}>{copy.questionSend}</Button>
    </div>
  </section>;
}

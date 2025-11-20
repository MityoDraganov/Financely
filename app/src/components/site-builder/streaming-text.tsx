import { useEffect, useState, useRef } from "react";

interface StreamingTextProps {
  text: string;
  speed?: number; // Characters per interval
  interval?: number; // Milliseconds between updates
  onComplete?: () => void;
  className?: string;
  shouldStream?: boolean; // Whether to stream or show immediately
}

/**
 * Component that displays text with a typewriter/streaming effect
 * Similar to ChatGPT's streaming responses
 */
export function StreamingText({
  text,
  speed = 1, // Slower - 1 character at a time for more satisfying effect
  interval = 50, // Slower interval - 50ms between characters for dopamine boost
  onComplete,
  className = "",
  shouldStream = true,
}: StreamingTextProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const targetTextRef = useRef<string>("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const currentIndexRef = useRef(0);

  // Handle text changes and streaming
  useEffect(() => {
    // Cleanup any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!text) {
      setDisplayedText("");
      setIsComplete(false);
      targetTextRef.current = "";
      currentIndexRef.current = 0;
      return;
    }

    // If we shouldn't stream, show immediately
    if (!shouldStream) {
      setDisplayedText(text);
      setIsComplete(true);
      targetTextRef.current = text;
      currentIndexRef.current = text.length;
      onComplete?.();
      return;
    }

    // Check if text changed to a completely new value
    const isNewText = targetTextRef.current !== text;
    
    if (isNewText) {
      // Reset for new text
      targetTextRef.current = text;
      currentIndexRef.current = 0;
      setDisplayedText("");
      setIsComplete(false);
    }

    // Stream function
    const stream = () => {
      const currentLength = currentIndexRef.current;
      const targetLength = text.length;

      if (currentLength >= targetLength) {
        setIsComplete(true);
        onComplete?.();
        return;
      }

      // Update displayed text
      const nextLength = Math.min(currentLength + speed, targetLength);
      currentIndexRef.current = nextLength;
      setDisplayedText(text.slice(0, nextLength));

      // Schedule next update
      if (nextLength < targetLength) {
        timerRef.current = setTimeout(stream, interval);
      } else {
        setIsComplete(true);
        onComplete?.();
      }
    };

    // Start streaming if we have text to stream and haven't completed
    if (text.length > 0 && currentIndexRef.current < text.length) {
      stream();
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [text, speed, interval, onComplete, shouldStream]);

  // If not streaming, show text immediately
  if (!shouldStream) {
    return <div className={className}>{text}</div>;
  }

  return (
    <div className={className}>
      <span className="whitespace-pre-wrap">{displayedText}</span>
      {!isComplete && displayedText.length < text.length && (
        <span className="inline-block w-2 h-4 bg-current ml-1 animate-pulse" />
      )}
    </div>
  );
}


import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Input } from "./input";
import { Label } from "./label";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  className?: string;
}

interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

interface ColorHSV {
  h: number;
  s: number;
  v: number;
}

function hexToRgb(hex: string): ColorRGB | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
}

function rgbToHsv(r: number, g: number, b: number): ColorHSV {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h = 0;
  if (diff !== 0) {
    if (max === r) {
      h = ((g - b) / diff + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      h = ((b - r) / diff + 2) / 6;
    } else {
      h = ((r - g) / diff + 4) / 6;
    }
  }

  const s = max === 0 ? 0 : diff / max;
  const v = max;

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    v: Math.round(v * 100),
  };
}

function hsvToRgb(h: number, s: number, v: number): ColorRGB {
  h = h / 360;
  s = s / 100;
  v = v / 100;

  let r: number, g: number, b: number;

  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
    default:
      r = 0;
      g = 0;
      b = 0;
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

function parseHex(hex: string): string | null {
  const cleaned = hex.replace("#", "");
  if (/^[0-9A-Fa-f]{6}$/.test(cleaned)) {
    return "#" + cleaned.toUpperCase();
  }
  if (/^[0-9A-Fa-f]{3}$/.test(cleaned)) {
    return "#" + cleaned.split("").map((c) => c + c).join("").toUpperCase();
  }
  return null;
}

function parseRgb(rgb: string): ColorRGB | null {
  const match = rgb.match(/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*$/);
  if (!match) return null;
  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);
  if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) return null;
  return { r, g, b };
}

function parseHsv(hsv: string): ColorHSV | null {
  const match = hsv.match(/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const s = parseInt(match[2], 10);
  const v = parseInt(match[3], 10);
  if (h < 0 || h > 360 || s < 0 || s > 100 || v < 0 || v > 100) return null;
  return { h, s, v };
}

export function ColorPicker({ value, onChange, label, className }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [internalColor, setInternalColor] = useState(value || "#000000");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hueSliderRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHueDragging, setIsHueDragging] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  
  // Track which input is focused
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  
  // Compute current RGB/HSV from internal color
  const currentRgb = useMemo(() => hexToRgb(internalColor) || { r: 0, g: 0, b: 0 }, [internalColor]);
  const currentHsv = useMemo(() => rgbToHsv(currentRgb.r, currentRgb.g, currentRgb.b), [currentRgb]);
  
  // Local input states for free typing - initialized after RGB/HSV computation
  const [hexInput, setHexInput] = useState(internalColor);
  const [rgbInput, setRgbInput] = useState(`${currentRgb.r}, ${currentRgb.g}, ${currentRgb.b}`);
  const [hsvInput, setHsvInput] = useState(`${currentHsv.h}, ${currentHsv.s}, ${currentHsv.v}`);
  
  // Update local inputs when color changes externally
  useEffect(() => {
    const currentRgb = hexToRgb(internalColor) || { r: 0, g: 0, b: 0 };
    const currentHsv = rgbToHsv(currentRgb.r, currentRgb.g, currentRgb.b);
    
    if (focusedInput !== 'hex') {
      setHexInput(internalColor);
    }
    if (focusedInput !== 'rgb') {
      setRgbInput(`${currentRgb.r}, ${currentRgb.g}, ${currentRgb.b}`);
    }
    if (focusedInput !== 'hsv') {
      setHsvInput(`${currentHsv.h}, ${currentHsv.s}, ${currentHsv.v}`);
    }
  }, [internalColor, focusedInput]);

  const getInitialHsv = () => {
    const rgb = hexToRgb(value || "#000000");
    if (rgb) {
      return rgbToHsv(rgb.r, rgb.g, rgb.b);
    }
    return { h: 0, s: 0, v: 0 };
  };

  const initialHsv = getInitialHsv();
  const [hue, setHue] = useState(initialHsv.h);
  const [sat, setSat] = useState(initialHsv.s);
  const [val, setVal] = useState(initialHsv.v);

  useEffect(() => {
    const rgb = hexToRgb(value);
    if (rgb) {
      const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
      setInternalColor(value);
      setHue(hsv.h);
      setSat(hsv.s);
      setVal(hsv.v);
    }
  }, [value]);

  useEffect(() => {
    if (isOpen) {
      const rgb = hexToRgb(value || internalColor);
      if (rgb) {
        const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
        setHue(hsv.h);
        setSat(hsv.s);
        setVal(hsv.v);
        setInternalColor(value || internalColor);
      }
    }
  }, [isOpen, value, internalColor]);

  // For display when not focused - use current computed values
  const rgb = currentRgb;
  const hsv = currentHsv;

  const drawColorWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 200;
    canvas.width = size;
    canvas.height = size;

    // Draw saturation/value square
    const gradient = ctx.createLinearGradient(0, 0, size, 0);
    gradient.addColorStop(0, "white");
    gradient.addColorStop(1, `hsl(${hue}, 100%, 50%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(10, 10, size - 20, size - 20);

    const blackGradient = ctx.createLinearGradient(0, 10, 0, size - 10);
    blackGradient.addColorStop(0, "rgba(0,0,0,0)");
    blackGradient.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = blackGradient;
    ctx.fillRect(10, 10, size - 20, size - 20);

    // Draw picker indicator
    const x = 10 + (sat / 100) * (size - 20);
    const y = 10 + (val / 100) * (size - 20);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.stroke();
  }, [hue, sat, val]);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      drawColorWheel();
    }
  }, [hue, sat, val, isOpen, drawColorWheel]);

  const updateColorFromPosition = useCallback((x: number, y: number) => {
    const size = 200;
    const padding = 10;

    const newSat = Math.max(0, Math.min(100, ((x - padding) / (size - padding * 2)) * 100));
    const newVal = Math.max(0, Math.min(100, ((y - padding) / (size - padding * 2)) * 100));

    const newRgb = hsvToRgb(hue, newSat, newVal);
    const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      setSat(newSat);
      setVal(newVal);
      setInternalColor(newHex);
      onChange(newHex);
    });
  }, [hue, onChange]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    updateColorFromPosition(x, y);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    updateColorFromPosition(x, y);
  };

  const drawHueSlider = useCallback(() => {
    const hueCanvas = hueSliderRef.current;
    if (!hueCanvas) return;

    const ctx = hueCanvas.getContext("2d");
    if (!ctx) return;

    const width = 200;
    const height = 20;
    hueCanvas.width = width;
    hueCanvas.height = height;

    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    for (let i = 0; i <= 360; i += 60) {
      gradient.addColorStop(i / 360, `hsl(${i}, 100%, 50%)`);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Draw hue indicator
    const x = (hue / 360) * width;
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }, [hue]);

  useEffect(() => {
    if (isOpen && hueSliderRef.current) {
      drawHueSlider();
    }
  }, [hue, isOpen, drawHueSlider]);

  const updateHue = useCallback((x: number, width: number) => {
    const newHue = Math.max(0, Math.min(360, (x / width) * 360));
    const newRgb = hsvToRgb(newHue, sat, val);
    const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      setHue(newHue);
      setInternalColor(newHex);
      onChange(newHex);
    });
  }, [sat, val, onChange]);

  const handleHueSliderClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = canvas.width;
    updateHue(x, width);
  };

  const handleHueSliderMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isHueDragging) return;
    e.preventDefault();
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = canvas.width;
    updateHue(x, width);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        if (animationFrameRef.current !== null) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [isOpen]);

  const applyHexValue = (hexValue: string) => {
    // Auto-add # if missing but user typed something
    let normalizedHex = hexValue.trim();
    if (normalizedHex && !normalizedHex.startsWith('#')) {
      normalizedHex = '#' + normalizedHex;
    }
    
    const parsed = parseHex(normalizedHex);
    if (parsed) {
      setInternalColor(parsed);
      onChange(parsed);
      const rgbValue = hexToRgb(parsed);
      if (rgbValue) {
        const hsvValue = rgbToHsv(rgbValue.r, rgbValue.g, rgbValue.b);
        setHue(hsvValue.h);
        setSat(hsvValue.s);
        setVal(hsvValue.v);
      }
      return true;
    }
    return false;
  };

  const applyRgbValue = (rgbStr: string) => {
    const parsed = parseRgb(rgbStr.trim());
    if (parsed) {
      const hex = rgbToHex(parsed.r, parsed.g, parsed.b);
      setInternalColor(hex);
      onChange(hex);
      const hsvValue = rgbToHsv(parsed.r, parsed.g, parsed.b);
      setHue(hsvValue.h);
      setSat(hsvValue.s);
      setVal(hsvValue.v);
      return true;
    }
    return false;
  };

  const applyHsvValue = (hsvStr: string) => {
    const parsed = parseHsv(hsvStr.trim());
    if (parsed) {
      setHue(parsed.h);
      setSat(parsed.s);
      setVal(parsed.v);
      const rgbValue = hsvToRgb(parsed.h, parsed.s, parsed.v);
      const hex = rgbToHex(rgbValue.r, rgbValue.g, rgbValue.b);
      setInternalColor(hex);
      onChange(hex);
      return true;
    }
    return false;
  };

  const handleHexInput = (value: string) => {
    setHexInput(value);
    
    // Apply in real-time for preview, but still validate on blur
    let normalizedHex = value.trim();
    if (normalizedHex && !normalizedHex.startsWith('#')) {
      normalizedHex = '#' + normalizedHex;
    }
    
    const parsed = parseHex(normalizedHex);
    if (parsed) {
      // Update preview in real-time
      const rgbValue = hexToRgb(parsed);
      if (rgbValue) {
        const hsvValue = rgbToHsv(rgbValue.r, rgbValue.g, rgbValue.b);
        setHue(hsvValue.h);
        setSat(hsvValue.s);
        setVal(hsvValue.v);
        setInternalColor(parsed);
        onChange(parsed);
      }
    }
  };

  const handleHexBlur = () => {
    const success = applyHexValue(hexInput);
    if (!success) {
      // Revert to last valid value
      setHexInput(internalColor);
    }
    setFocusedInput(null);
  };

  const handleHexKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const handleRgbInput = (value: string) => {
    setRgbInput(value);
    
    // Apply in real-time for preview
    const parsed = parseRgb(value.trim());
    if (parsed) {
      const hex = rgbToHex(parsed.r, parsed.g, parsed.b);
      const hsvValue = rgbToHsv(parsed.r, parsed.g, parsed.b);
      setHue(hsvValue.h);
      setSat(hsvValue.s);
      setVal(hsvValue.v);
      setInternalColor(hex);
      onChange(hex);
    }
  };

  const handleRgbBlur = () => {
    const success = applyRgbValue(rgbInput);
    if (!success) {
      const currentRgb = hexToRgb(internalColor) || { r: 0, g: 0, b: 0 };
      setRgbInput(`${currentRgb.r}, ${currentRgb.g}, ${currentRgb.b}`);
    }
    setFocusedInput(null);
  };

  const handleRgbKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const handleHsvInput = (value: string) => {
    setHsvInput(value);
    
    // Apply in real-time for preview
    const parsed = parseHsv(value.trim());
    if (parsed) {
      setHue(parsed.h);
      setSat(parsed.s);
      setVal(parsed.v);
      const rgbValue = hsvToRgb(parsed.h, parsed.s, parsed.v);
      const hex = rgbToHex(rgbValue.r, rgbValue.g, rgbValue.b);
      setInternalColor(hex);
      onChange(hex);
    }
  };

  const handleHsvBlur = () => {
    const success = applyHsvValue(hsvInput);
    if (!success) {
      const currentRgb = hexToRgb(internalColor) || { r: 0, g: 0, b: 0 };
      const currentHsv = rgbToHsv(currentRgb.r, currentRgb.g, currentRgb.b);
      setHsvInput(`${currentHsv.h}, ${currentHsv.s}, ${currentHsv.v}`);
    }
    setFocusedInput(null);
  };

  const handleHsvKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  // Helper to check if current input is valid
  const isHexValid = () => {
    if (focusedInput !== 'hex') return true;
    const normalized = hexInput.trim().startsWith('#') ? hexInput.trim() : '#' + hexInput.trim();
    return parseHex(normalized) !== null;
  };

  const isRgbValid = () => {
    if (focusedInput !== 'rgb') return true;
    return parseRgb(rgbInput.trim()) !== null;
  };

  const isHsvValid = () => {
    if (focusedInput !== 'hsv') return true;
    return parseHsv(hsvInput.trim()) !== null;
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label>{label}</Label>}
      <div className="flex items-center gap-2">
        <div className="relative" ref={containerRef}>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="w-12 h-12 rounded border-2 border-gray-300 shadow-sm hover:border-gray-400 transition-colors"
            style={{ backgroundColor: internalColor }}
            aria-label="Pick color"
          />
          {isOpen && (
            <div className="absolute z-50 left-0 mt-2 p-4 bg-white border border-gray-200 rounded-lg shadow-xl w-[240px]">
              <div className="space-y-4">
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    width={200}
                    height={200}
                    className="cursor-crosshair rounded border border-gray-300"
                    onClick={handleCanvasClick}
                    onMouseDown={() => setIsDragging(true)}
                    onMouseUp={() => setIsDragging(false)}
                    onMouseLeave={() => setIsDragging(false)}
                    onMouseMove={handleCanvasMouseMove}
                  />
                </div>
                <div className="relative">
                  <canvas
                    ref={hueSliderRef}
                    width={200}
                    height={20}
                    className="cursor-pointer rounded border border-gray-300"
                    onClick={handleHueSliderClick}
                    onMouseDown={() => setIsHueDragging(true)}
                    onMouseUp={() => setIsHueDragging(false)}
                    onMouseLeave={() => setIsHueDragging(false)}
                    onMouseMove={handleHueSliderMouseMove}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">HEX</Label>
                    <Input
                      value={focusedInput === 'hex' ? hexInput : internalColor}
                      onChange={(e) => handleHexInput(e.target.value)}
                      onFocus={() => setFocusedInput('hex')}
                      onBlur={handleHexBlur}
                      onKeyDown={handleHexKeyDown}
                      className={cn(
                        "text-xs font-mono",
                        focusedInput === 'hex' && !isHexValid() && "border-red-500 focus-visible:ring-red-500"
                      )}
                      placeholder="#000000"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">RGB</Label>
                    <Input
                      value={focusedInput === 'rgb' ? rgbInput : `${rgb.r}, ${rgb.g}, ${rgb.b}`}
                      onChange={(e) => handleRgbInput(e.target.value)}
                      onFocus={() => setFocusedInput('rgb')}
                      onBlur={handleRgbBlur}
                      onKeyDown={handleRgbKeyDown}
                      className={cn(
                        "text-xs font-mono",
                        focusedInput === 'rgb' && !isRgbValid() && "border-red-500 focus-visible:ring-red-500"
                      )}
                      placeholder="0, 0, 0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">HSV</Label>
                    <Input
                      value={focusedInput === 'hsv' ? hsvInput : `${hsv.h}, ${hsv.s}, ${hsv.v}`}
                      onChange={(e) => handleHsvInput(e.target.value)}
                      onFocus={() => setFocusedInput('hsv')}
                      onBlur={handleHsvBlur}
                      onKeyDown={handleHsvKeyDown}
                      className={cn(
                        "text-xs font-mono",
                        focusedInput === 'hsv' && !isHsvValid() && "border-red-500 focus-visible:ring-red-500"
                      )}
                      placeholder="0, 0, 0"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <Input
          value={internalColor}
          onChange={(e) => {
            const success = applyHexValue(e.target.value);
            if (!success && e.target.value.trim() === '') {
              // Allow clearing
              setHexInput('');
            }
          }}
          onBlur={(e) => {
            if (!e.target.value || !parseHex(e.target.value)) {
              e.target.value = internalColor;
            }
          }}
          className="flex-1 font-mono text-sm"
          placeholder="#000000"
        />
      </div>
    </div>
  );
}


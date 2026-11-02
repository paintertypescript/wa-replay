"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { ChatData } from "@/lib/types";

export function prettyDay(value: string, options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" }) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", options);
}

export default function Calendar({ days, current, onSelect }: { days: ChatData["days"]; current: string; onSelect: (date: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [month, setMonth] = useState(current.slice(0, 7));
  const [year, monthNumber] = month.split("-").map(Number);
  const first = days[0].date.slice(0, 7);
  const last = days[days.length - 1].date.slice(0, 7);
  const dayMap = new Map(days.map((day) => [day.date, day.count]));
  const offset = new Date(year, monthNumber - 1, 1).getDay();
  const count = new Date(year, monthNumber, 0).getDate();
  const years = Array.from({ length: Number(last.slice(0, 4)) - Number(first.slice(0, 4)) + 1 }, (_, index) => Number(first.slice(0, 4)) + index);
  useEffect(() => { setMonth(current.slice(0, 7)); }, [current]);
  function move(amount: number) {
    const next = new Date(year, monthNumber - 1 + amount, 1);
    setMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
  }
  return <>
    <button className="calendar-trigger" onClick={() => { setMonth(current.slice(0, 7)); dialog.current?.showModal(); }}>
      <CalendarDays size={17} /><span>{prettyDay(current)}</span><span className="button-hint">Jump to date</span>
    </button>
    <dialog ref={dialog} className="calendar-dialog" aria-labelledby="calendar-title" onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="dialog-header"><div><p className="eyebrow">FIND A MOMENT</p><h2 id="calendar-title">A day in your story</h2></div><button autoFocus className="icon-button" aria-label="Close calendar" onClick={() => dialog.current?.close()}><X size={20} /></button></div>
      <p className="muted calendar-description">Choose a highlighted day to revisit its messages.</p>
      <div className="month-controls">
        <button className="icon-button" aria-label="Previous month" disabled={month <= first} onClick={() => move(-1)}><ChevronLeft size={19} /></button>
        <div className="month-selects">
          <select aria-label="Calendar month" value={monthNumber} onChange={(event) => setMonth(`${year}-${event.target.value.padStart(2, "0")}`)}>
            {Array.from({ length: 12 }, (_, index) => <option key={index} value={index + 1} disabled={`${year}-${String(index + 1).padStart(2, "0")}` < first || `${year}-${String(index + 1).padStart(2, "0")}` > last}>{new Date(2024, index, 1).toLocaleDateString("en-US", { month: "long" })}</option>)}
          </select>
          <select aria-label="Calendar year" value={year} onChange={(event) => { const next = `${event.target.value}-${String(monthNumber).padStart(2, "0")}`; setMonth(next < first ? first : next > last ? last : next); }}>{years.map((year) => <option key={year}>{year}</option>)}</select>
        </div>
        <button className="icon-button" aria-label="Next month" disabled={month >= last} onClick={() => move(1)}><ChevronRight size={19} /></button>
      </div>
      <div className="calendar-grid">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <span className="weekday" key={day}>{day}</span>)}
        {Array.from({ length: offset }, (_, index) => <span key={`empty-${index}`} />)}
        {Array.from({ length: count }, (_, index) => {
          const date = `${month}-${String(index + 1).padStart(2, "0")}`;
          const messages = dayMap.get(date);
          return <button key={date} disabled={!messages} aria-label={`${prettyDay(date)}, ${messages || 0} messages`} aria-current={current === date ? "date" : undefined} className={`calendar-day ${current === date ? "selected" : ""}`} onClick={() => { onSelect(date); dialog.current?.close(); }}>{index + 1}<span className="day-dot" /></button>;
        })}
      </div>
      <div className="calendar-legend"><span className="legend-dot" /> Days with conversations <span>{days.filter((day) => day.date.startsWith(month)).length} this month</span></div>
    </dialog>
  </>;
}

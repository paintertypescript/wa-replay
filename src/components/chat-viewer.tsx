"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpRight, CalendarDays, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, FileArchive, FileText, FolderOpen, Image as ImageIcon, LockKeyhole, MessageCircle, MessagesSquare, RefreshCw, Search, Users, X } from "lucide-react";
import Calendar, { prettyDay } from "./calendar";
import type { Attachment, ChatData, ChatMessage, DateOrder } from "@/lib/types";

interface Archive { name: string; size: number; modified: string }
const number = (value: number) => value.toLocaleString("en-US");
const title = (name: string) => name.replace(/\.zip$/i, "").replace(/^WhatsApp Chat (?:with|-)\s*/i, "").replace(/_/g, " ");
const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const size = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

async function readJson(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Something went wrong while reading the export.");
  return body;
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return text;
  const lower = text.toLocaleLowerCase();
  const needle = query.trim().toLocaleLowerCase();
  const pieces: React.ReactNode[] = [];
  let start = 0;
  let index = lower.indexOf(needle);
  while (index !== -1) {
    pieces.push(text.slice(start, index), <mark key={index}>{text.slice(index, index + needle.length)}</mark>);
    start = index + needle.length;
    index = lower.indexOf(needle, start);
  }
  pieces.push(text.slice(start));
  return pieces;
}

function Media({ attachment, archive, onExpand }: { attachment: Attachment; archive: string; onExpand: (src: string, name: string) => void }) {
  const [failed, setFailed] = useState(false);
  const src = `/api/media?${new URLSearchParams({ archive, path: attachment.path })}`;
  const download = <a className="attachment-link" href={src} download={attachment.name}><FileText size={22} /><span>{attachment.name}<small>Open or download attachment</small></span><ArrowUpRight size={16} /></a>;
  if (failed) return <div className="media-fallback"><span>This media format could not be displayed.</span>{download}</div>;
  if (attachment.kind === "image") return <button className="image-button" aria-label={`View ${attachment.name}`} onClick={() => onExpand(src, attachment.name)}>
    {/* Local ZIP media may have arbitrary names and formats; serve the original bytes. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={src} alt={attachment.name} loading="lazy" onError={() => setFailed(true)} />
    <span className="image-expand"><ArrowUpRight size={16} /></span>
  </button>;
  if (attachment.kind === "video") return <div className="media-player"><video controls preload="metadata" src={src} onError={() => setFailed(true)} aria-label={attachment.name} />{download}</div>;
  if (attachment.kind === "audio") return <div className="media-player"><audio controls preload="none" src={src} onError={() => setFailed(true)} aria-label={attachment.name} /><small>{attachment.name}</small></div>;
  return download;
}

function Message({ message, outgoing, color, archive, query, onExpand }: { message: ChatMessage; outgoing: boolean; color: number; archive: string; query: string; onExpand: (src: string, name: string) => void }) {
  if (!message.sender) return <div className="system-message"><LockKeyhole size={12} /><span><Highlight text={message.text} query={query} /></span></div>;
  return <div className={`message-row ${outgoing ? "outgoing" : "incoming"}`}>
    {!outgoing && <div className={`avatar avatar-small color-${color % 5}`} title={message.sender}>{initials(message.sender)}</div>}
    <article className="message-bubble" data-message-id={message.id}>
      <div className={`sender-name text-color-${color % 5}`}>{message.sender}</div>
      {message.attachments.map((attachment) => <Media key={attachment.path} attachment={attachment} archive={archive} onExpand={onExpand} />)}
      {message.text && <p className="message-text"><Highlight text={message.text} query={query} /></p>}
      <div className="message-time"><time>{message.time.slice(0, 5)}</time>{outgoing && <CheckCheck size={14} aria-label="Exported message" />}</div>
    </article>
  </div>;
}

function Conversation({ chat, archive }: { chat: ChatData; archive: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const lightbox = useRef<HTMLDialogElement>(null);
  const [image, setImage] = useState({ src: "", name: "" });
  const [query, setQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(-1);
  const [perspective, setPerspective] = useState(chat.participants[chat.participants.length - 1] || "");
  const [activeDay, setActiveDay] = useState(chat.messages[0].date);
  const virtualizer = useVirtualizer({ count: chat.messages.length, getScrollElement: () => scroller.current, estimateSize: (index) => chat.messages[index].attachments.length ? 340 : 110, overscan: 8 });
  const rows = virtualizer.getVirtualItems();
  const firstVisible = rows.find((row) => row.end > virtualizer.scrollOffset!);
  const visibleDay = chat.messages[firstVisible?.index || 0]?.date;
  useEffect(() => { if (visibleDay) setActiveDay(visibleDay); }, [visibleDay]);
  const matches = useMemo(() => query.trim() ? chat.messages.flatMap((message, index) => `${message.sender || ""}\n${message.text}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) ? [index] : []) : [], [chat.messages, query]);
  function jump(index: number) {
    virtualizer.scrollToIndex(index, { align: "start" });
    setActiveDay(chat.messages[index].date);
  }
  function jumpDay(date: string) {
    const day = chat.days.find((day) => day.date === date);
    if (day) jump(day.index);
  }
  function findMatch(direction: number) {
    if (!matches.length) return;
    const next = matchIndex === -1 ? (direction > 0 ? 0 : matches.length - 1) : (matchIndex + direction + matches.length) % matches.length;
    setMatchIndex(next);
    jump(matches[next]);
  }
  function expand(src: string, name: string) {
    setImage({ src, name });
    lightbox.current?.showModal();
  }
  const dayIndex = chat.days.findIndex((day) => day.date === activeDay);
  return <>
    <div className="conversation-tools">
      <Calendar days={chat.days} current={activeDay} onSelect={jumpDay} />
      <div className="search-box"><Search size={16} /><input aria-label="Search messages" placeholder="Search this conversation" value={query} onChange={(event) => { setQuery(event.target.value); setMatchIndex(-1); }} onKeyDown={(event) => { if (event.key === "Enter") findMatch(event.shiftKey ? -1 : 1); }} />
        {query && <><span className="match-count" aria-live="polite">{matches.length ? `${matchIndex + 1}/${matches.length}` : "0 found"}</span><button className="icon-button compact" aria-label="Previous search result" disabled={!matches.length} onClick={() => findMatch(-1)}><ChevronLeft size={16} /></button><button className="icon-button compact" aria-label="Next search result" disabled={!matches.length} onClick={() => findMatch(1)}><ChevronRight size={16} /></button><button className="icon-button compact" aria-label="Clear search" onClick={() => setQuery("")}><X size={14} /></button></>}
      </div>
    </div>
    <div className="reading-options"><span><span className="live-dot" /> {number(chat.messages.length)} messages, just as they happened</span><label>Right-side sender <select aria-label="Right-side sender" value={perspective} onChange={(event) => setPerspective(event.target.value)}>{chat.participants.map((person) => <option key={person}>{person}</option>)}</select><ChevronDown size={12} /></label></div>
    <div className="message-scroller" ref={scroller} tabIndex={0} aria-label="Chat history">
      <div className="virtual-list" style={{ height: virtualizer.getTotalSize() }}>
        {rows.map((row) => {
          const message = chat.messages[row.index];
          const newDay = row.index === 0 || chat.messages[row.index - 1].date !== message.date;
          return <div key={row.key} data-index={row.index} ref={virtualizer.measureElement} className="virtual-row" style={{ transform: `translateY(${row.start}px)` }}>
            {newDay && <div className="date-divider"><span>{prettyDay(message.date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span></div>}
            <Message message={message} outgoing={message.sender === perspective} color={chat.participants.indexOf(message.sender || "")} archive={archive} query={query} onExpand={expand} />
          </div>;
        })}
      </div>
      <div className="end-space" />
    </div>
    <footer className="conversation-footer"><div className="day-nav"><button className="icon-button" aria-label="Previous day" disabled={dayIndex <= 0} onClick={() => jumpDay(chat.days[dayIndex - 1].date)}><ChevronLeft size={18} /></button><span>{dayIndex + 1} of {number(chat.days.length)} days</span><button className="icon-button" aria-label="Next day" disabled={dayIndex >= chat.days.length - 1} onClick={() => jumpDay(chat.days[dayIndex + 1].date)}><ChevronRight size={18} /></button></div><span className="readonly-note">A little time travel. All read-only.</span><div className="edge-nav"><button title="First message" aria-label="First message" className="icon-button" onClick={() => jump(0)}><ArrowUp size={17} /></button><button title="Latest message" aria-label="Latest message" className="icon-button" onClick={() => jump(chat.messages.length - 1)}><ArrowDown size={17} /></button></div></footer>
    <dialog ref={lightbox} className="lightbox" aria-label="Image preview" onClick={(event) => { if (event.target === event.currentTarget) lightbox.current?.close(); }}><div className="lightbox-header"><span>{image.name}</span><button autoFocus className="icon-button" aria-label="Close image" onClick={() => lightbox.current?.close()}><X size={22} /></button></div>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={image.src || undefined} alt={image.name} /><a href={image.src} download={image.name}>Download original <ArrowDown size={15} /></a></dialog>
  </>;
}

export default function ChatViewer() {
  const [archives, setArchives] = useState<Archive[]>([]);
  const [archive, setArchive] = useState("");
  const [chat, setChat] = useState<ChatData | null>(null);
  const [transcript, setTranscript] = useState("");
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const [dateOrder, setDateOrder] = useState<DateOrder>("auto");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revision, setRevision] = useState(0);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError("");
    try {
      const body = await readJson(await fetch("/api/archives", { cache: "no-store" }));
      setArchives(body.archives);
      setTranscript("");
      setArchive((current) => body.archives.some((item: Archive) => item.name === current) ? current : body.archives[0]?.name || "");
      setRevision((value) => value + 1);
    } catch (error) { setError((error as Error).message); }
    finally { setRefreshing(false); setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!archive) { setChat(null); return; }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ archive, dateOrder });
    if (transcript) params.set("transcript", transcript);
    fetch(`/api/chat?${params}`, { signal: controller.signal, cache: "no-store" }).then(async (response) => {
      const body = await response.json();
      if (controller.signal.aborted) return;
      setTranscripts(body.transcripts || []);
      if (!response.ok) throw new Error(body.error || "The chat could not be loaded.");
      setChat(body);
    }).catch((error) => { if (error.name !== "AbortError") { setChat(null); setError(error.message); } }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [archive, transcript, dateOrder, revision]);
  function choose(name: string) { setArchive(name); setTranscript(""); if (name !== archive) setTranscripts([]); setLibraryOpen(false); }
  return <div className="app-shell">
    <aside className={`sidebar ${libraryOpen ? "sidebar-open" : ""}`}>
      <a className="brand" href="/"><span className="brand-icon"><MessagesSquare size={24} strokeWidth={1.6} /></span><span>wa-replay<span className="brand-dot">.</span></span></a>
      <p className="brand-tagline">Your conversations, revisited.</p>
      <div className="library-heading"><span className="eyebrow">YOUR LIBRARY</span><button className={`icon-button ${refreshing ? "spinning" : ""}`} title="Refresh data folder" aria-label="Refresh library" onClick={refresh} disabled={refreshing}><RefreshCw size={15} /></button></div>
      <nav className="archive-list" aria-label="Chat exports">{archives.map((item) => <button key={item.name} className={`archive-card ${archive === item.name ? "active" : ""}`} onClick={() => choose(item.name)}><span className="archive-icon"><MessageCircle size={19} /></span><span className="archive-card-text"><strong>{title(item.name)}</strong><small>WhatsApp export · {size(item.size)}</small></span>{archive === item.name && <span className="selected-dot" />}</button>)}{!archives.length && <div className="library-empty"><FolderOpen size={23} /><p>Your stories go here.<br /><span>Add a ZIP to get started.</span></p></div>}</nav>
      {chat && <div className="sidebar-details"><p className="eyebrow">IN THIS CONVERSATION</p><div className="people-list">{chat.participants.map((person, index) => <div key={person}><span className={`avatar color-${index % 5}`}>{initials(person)}</span><span>{person}</span></div>)}</div><div className="date-range"><CalendarDays size={15} /><span>{prettyDay(chat.days[0].date, { month: "short", year: "numeric" })} — {prettyDay(chat.days[chat.days.length - 1].date, { month: "short", year: "numeric" })}</span></div></div>}
      <div className="sidebar-bottom"><div className="folder-note"><FolderOpen size={18} /><div><strong>A home for your exports</strong><p>Put WhatsApp ZIP files in <code>data/</code>, then refresh your library.</p></div></div><div className="privacy-note"><LockKeyhole size={13} /><span>Local files. Private memories.</span></div></div>
    </aside>
    {libraryOpen && <button className="sidebar-backdrop" aria-label="Close library" onClick={() => setLibraryOpen(false)} />}
    <main className="main-panel">
      <header className="page-header"><div className="page-heading"><button className="mobile-library icon-button" aria-label="Open library" onClick={() => setLibraryOpen(true)}><FolderOpen size={21} /></button><div><p className="eyebrow"><span className="header-line" /> THE CONVERSATION ARCHIVE</p><h1>{archive ? title(archive) : "Every conversation has a story."}</h1><p className="header-subtitle">{chat ? `${chat.participants.length} people. ${number(chat.days.length)} days. Countless little moments.` : "Keep the messages. Revisit the moments."}</p></div></div><div className="local-badge"><span className="live-dot" /> LOCAL ARCHIVE</div></header>
      <div className="content-area">
        {chat && <div className="stats-row"><div><MessagesSquare size={19} /><span><strong>{number(chat.messages.length)}</strong> messages</span></div><div><ImageIcon size={19} /><span><strong>{number(chat.mediaCount)}</strong> attachments</span></div><div><Users size={19} /><span><strong>{chat.participants.length}</strong> participants</span></div><span className="export-label"><FileArchive size={14} /> From your WhatsApp export</span></div>}
        {archive && <div className="import-options"><label>Export dates <select aria-label="Export date format" value={dateOrder} onChange={(event) => setDateOrder(event.target.value as DateOrder)}><option value="auto">Auto detect</option><option value="dmy">Day / month / year</option><option value="mdy">Month / day / year</option><option value="ymd">Year / month / day</option></select></label>{transcripts.length > 1 && <label>Transcript <select aria-label="Transcript" value={transcript || chat?.transcript || transcripts[0]} onChange={(event) => setTranscript(event.target.value)}>{transcripts.map((name) => <option key={name}>{name}</option>)}</select></label>}{chat?.ambiguousDates && dateOrder === "auto" && <span className="date-hint">Dates are ambiguous; using day / month / year. Change if needed.</span>}</div>}
        {error && <div role="alert" className="notice error-notice"><FileText size={18} /><span>{error}</span><button onClick={refresh}>Try again</button></div>}
        {chat?.warnings.map((warning) => <div role="status" className="notice" key={warning}>{warning}</div>)}
        <section className={`conversation-card ${!chat || loading ? "empty-card" : ""}`} aria-label="Conversation viewer" aria-busy={loading}>
          {loading ? <div className="empty-state"><RefreshCw className="loading-icon" size={30} /><h2>Opening your archive…</h2><p>Gathering the messages and moments.</p></div> : chat ? <Conversation key={`${archive}:${chat.transcript}:${dateOrder}:${revision}`} chat={chat} archive={archive} /> : <div className="empty-state"><div className="empty-illustration"><span className="empty-orbit" /><MessagesSquare size={44} strokeWidth={1.3} /><span className="tiny-photo"><ImageIcon size={21} /></span></div><span className="eyebrow">A PLACE FOR YOUR MEMORIES</span><h2>Your next trip down memory lane.</h2><p>Bring a WhatsApp conversation back to life,<br />one message, photo, and day at a time.</p><ol className="setup-steps"><li><span>1</span>Export a WhatsApp chat <strong>with media</strong>.</li><li><span>2</span>Place the ZIP file in this project’s <code>data/</code> folder.</li><li><span>3</span>Refresh your library and start exploring.</li></ol><button className="primary-button" onClick={refresh}><RefreshCw size={16} /> Refresh library</button><span className="empty-privacy"><LockKeyhole size={12} /> Your ZIP files are ignored by Git.</span></div>}
        </section>
        <div className="page-footnote"><span>Made for the moments between the messages.</span><span>wa-replay <span className="footnote-spark">✳</span></span></div>
      </div>
    </main>
  </div>;
}

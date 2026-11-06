import { createFileRoute, useLocation } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import {
  Send,
  FileText,
  Zap,
  Loader2,
  AlertCircle,
  X,
  Plus,
  Trash2,
  MessageSquare,
  Copy,
  Check,
  Edit2,
  ChevronDown,
  ChevronRight,
  Search,
  Sparkles,
  Eraser,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import {
  DocumentService,
  DocumentResponse,
  ChatSourceMetadata,
} from "@/services/documentService";
import {
  ConversationService,
  ConversationResponse,
} from "@/services/conversationService";
import { toast } from "sonner";

export const Route = createFileRoute("/_user/ai-query")({ component: AIQuery });

interface ChatMessage {
  id: string;
  from: "user" | "ai";
  content: string;
  sources?: ChatSourceMetadata[] | null;
  created_at?: string;
  error?: string;
  loading?: boolean;
}

const SUGGESTED_PROMPTS = [
  "Summarize this document.",
  "What are the main arguments and methodologies?",
  "Extract important facts and conclusions.",
  "What questions does this document leave unanswered?",
];

function AIQuery() {
  const location = useLocation();
  const [conversations, setConversations] = useState<ConversationResponse[]>([]);
  const [convSearch, setConvSearch] = useState("");
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [scope, setScope] = useState<"current" | "all">("current");
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [attachedDoc, setAttachedDoc] = useState<DocumentResponse | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch documents and conversation list on mount
  useEffect(() => {
    loadDocumentsAndConversations();
  }, [location.state]);

  const loadDocumentsAndConversations = async () => {
    try {
      const [docResponse, convListResponse] = await Promise.allSettled([
        DocumentService.listDocuments(0, 100),
        ConversationService.listConversations(0, 50),
      ]);

      let loadedDocs: DocumentResponse[] = [];
      if (docResponse.status === "fulfilled") {
        loadedDocs = docResponse.value.documents || [];
        setDocuments(loadedDocs);
      }

      if (convListResponse.status === "fulfilled") {
        setConversations(convListResponse.value.conversations || []);
      }

      // Check handoff from Documents page
      const selectedDocFromState = (location.state as any)?.selectedDocument;
      if (selectedDocFromState) {
        const docId = selectedDocFromState.id;
        const exists = loadedDocs.find((d) => d.id === docId);
        const resolvedDoc = exists || selectedDocFromState;

        setSelectedDocId(resolvedDoc.id);
        setAttachedDoc(resolvedDoc);
        setScope("current");
        startNewConversation(resolvedDoc.id, resolvedDoc.filename);
        return;
      }

      // If conversations exist, load the latest conversation by default
      if (
        convListResponse.status === "fulfilled" &&
        (convListResponse.value.conversations || []).length > 0 &&
        !activeConvId
      ) {
        const latest = convListResponse.value.conversations[0];
        loadConversation(latest.id);
      } else if (loadedDocs.length > 0 && !selectedDocId) {
        setSelectedDocId(loadedDocs[0].id);
        setAttachedDoc(loadedDocs[0]);
      }
    } catch (err) {
      console.error("Failed to load initial data for AI Query:", err);
    }
  };

  // Sync attachedDoc with dropdown selection
  useEffect(() => {
    if (selectedDocId && documents.length > 0) {
      const doc = documents.find((d) => d.id === selectedDocId);
      if (doc) {
        setAttachedDoc(doc);
      }
    } else if (!selectedDocId) {
      setAttachedDoc(null);
    }
  }, [selectedDocId, documents]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConversation = async (convId: string) => {
    try {
      setIsLoadingHistory(true);
      setActiveConvId(convId);
      setMobileSidebarOpen(false);
      const detail = await ConversationService.getConversation(convId);

      const mappedMessages: ChatMessage[] = (detail.messages || []).map((m) => ({
        id: m.id,
        from: m.from_user,
        content: m.content,
        sources: m.sources,
        created_at: m.created_at,
      }));
      setMessages(mappedMessages);

      if (detail.conversation.document_id) {
        setSelectedDocId(detail.conversation.document_id);
        setScope("current");
      }
    } catch (err) {
      console.error("Failed to load conversation history:", err);
      toast.error("Failed to load conversation history");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const startNewConversation = (
    explicitDocId?: string,
    explicitDocName?: string,
  ) => {
    setActiveConvId(null);
    setMessages([]);
    setInput("");
    setMobileSidebarOpen(false);

    if (explicitDocId) {
      setSelectedDocId(explicitDocId);
      setScope("current");
      const doc = documents.find((d) => d.id === explicitDocId);
      if (doc) setAttachedDoc(doc);
    }

    textareaRef.current?.focus();
    toast.success("Started a new chat session");
  };

  const handleRename = async (e: React.FormEvent, convId: string) => {
    e.preventDefault();
    if (!renameTitle.trim()) {
      setRenamingId(null);
      return;
    }
    try {
      const updated = await ConversationService.renameConversation(
        convId,
        renameTitle.trim(),
      );
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? updated : c)),
      );
      toast.success("Conversation renamed");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to rename conversation",
      );
    } finally {
      setRenamingId(null);
      setRenameTitle("");
    }
  };

  const handleDeleteConversation = async (
    e: React.MouseEvent,
    convId: string,
    title: string,
  ) => {
    e.stopPropagation();
    if (
      !confirm(`Are you sure you want to permanently delete "${title}"?`)
    ) {
      return;
    }
    try {
      await ConversationService.deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConvId === convId) {
        startNewConversation();
      }
      toast.success("Conversation deleted");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete conversation",
      );
    }
  };

  const handleClearMessages = async () => {
    if (!activeConvId) return;
    if (!confirm("Are you sure you want to clear all messages in this conversation?")) {
      return;
    }
    try {
      await ConversationService.clearConversationMessages(activeConvId);
      setMessages([]);
      toast.success("Conversation cleared");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to clear conversation",
      );
    }
  };

  const handleRemoveAttachment = () => {
    setAttachedDoc(null);
    setSelectedDocId("");
    toast.info("Attachment removed. You can select another or switch to 'All Documents'.");
  };

  const handlePromptClick = (promptText: string) => {
    setInput(promptText);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const query = input.trim();
    if (!query || isLoading) return;

    if (scope === "current" && !selectedDocId) {
      toast.error("Please select a document before asking a question.");
      return;
    }

    const userMsgId = `user-${Date.now()}`;
    const aiMsgId = `ai-${Date.now()}`;
    const nowIso = new Date().toISOString();

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, from: "user", content: query, created_at: nowIso },
      { id: aiMsgId, from: "ai", content: "", loading: true, created_at: nowIso },
    ]);
    setInput("");
    setIsLoading(true);

    try {
      const docIdParam = scope === "current" ? selectedDocId : undefined;
      let currentConvId = activeConvId;

      if (!currentConvId) {
        const docName = attachedDoc?.filename;
        const newConv = await ConversationService.createConversation(
          undefined,
          docIdParam,
          docName,
        );
        currentConvId = newConv.id;
        setActiveConvId(newConv.id);
        setConversations((prev) => [newConv, ...prev]);
      }

      const aiResponse = await ConversationService.sendMessage(
        currentConvId,
        query,
        docIdParam,
      );

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMsgId
            ? {
                id: aiResponse.id,
                from: "ai",
                content: aiResponse.content,
                sources: aiResponse.sources,
                created_at: aiResponse.created_at,
                loading: false,
              }
            : msg,
        ),
      );

      const updatedList = await ConversationService.listConversations(0, 50);
      setConversations(updatedList.conversations || []);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to get AI response";
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMsgId
            ? { ...msg, content: "", error: errorMessage, loading: false }
            : msg,
        ),
      );
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  };

  const filteredConversations = conversations.filter((c) =>
    (c.title || "").toLowerCase().includes(convSearch.toLowerCase()),
  );

  return (
    <div className="w-full flex flex-col md:flex-row h-[calc(100vh-13.5rem)] min-h-[580px] gap-4 sm:gap-5 text-[#EDE7DC] font-['Sora',sans-serif]">
      {/* ====================================================================
          LEFT SIDEBAR: CONVERSATION HISTORY & NEW CHAT
          ==================================================================== */}
      <aside
        className={`${
          mobileSidebarOpen ? "flex" : "hidden"
        } md:flex flex-col w-full md:w-[310px] lg:w-[335px] shrink-0 bg-[#101317] border border-[rgba(237,231,220,0.12)] rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.35)]`}
      >
        {/* Header & New Chat Button with increased pill size and no text overflow */}
        <div
          className="border-b border-[rgba(237,231,220,0.1)] flex items-center justify-between gap-2.5 shrink-0"
          style={{ padding: "18px 18px" }}
        >
          <div className="flex items-center gap-2">
            <h2 className="font-['Syne',sans-serif] text-[17px] font-bold text-[#EDE7DC]">
              Conversations
            </h2>
            {conversations.length > 0 && (
              <span className="text-[11px] font-mono text-[#9EA5A8] bg-[#0A0C0E] border border-[rgba(237,231,220,0.14)] px-2 py-0.5 rounded-full">
                {conversations.length}
              </span>
            )}
          </div>
          <button
            onClick={() => startNewConversation()}
            className="h-10 rounded-full bg-[#E8913C] hover:bg-[#f39c4a] text-[#0A0C0E] font-bold text-[12.5px] transition-all shadow-[0_2px_12px_rgba(232,145,60,0.3)] flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 active:scale-[0.98]"
            style={{ paddingLeft: "16px", paddingRight: "16px", minWidth: "110px" }}
            title="Start new chat"
          >
            <Plus className="h-4 w-4 stroke-[2.4] shrink-0" />
            <span className="whitespace-nowrap">New Chat</span>
          </button>
        </div>

        {/* Search within conversations: generous vertical spacing and no icon overlap */}
        {conversations.length > 0 && (
          <div
            className="border-b border-[rgba(237,231,220,0.08)]"
            style={{ padding: "16px 18px" }}
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9EA5A8]" />
              <input
                placeholder="Filter chats..."
                value={convSearch}
                onChange={(e) => setConvSearch(e.target.value)}
                className="h-10 w-full rounded-xl text-xs bg-[#080B0D] border border-[rgba(237,231,220,0.14)] text-[#EDE7DC] placeholder-[#6C7378] focus:border-[#E8913C] focus:outline-none transition-colors box-border"
                style={{ paddingLeft: "42px", paddingRight: "36px" }}
              />
              {convSearch && (
                <button
                  onClick={() => setConvSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9EA5A8] hover:text-[#EDE7DC]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Conversation List / Empty State: comfortable vertical spacing between chats */}
        <div
          className="flex-1 overflow-y-auto"
          style={{
            padding: "18px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {conversations.length === 0 ? (
            <div
              className="rounded-2xl border border-dashed border-[rgba(237,231,220,0.16)] bg-[#0A0C0E]/60 text-center text-xs text-[#9EA5A8]"
              style={{ marginTop: "16px", marginBottom: "16px", padding: "32px 20px" }}
            >
              <div className="w-12 h-12 rounded-xl bg-[#42C8D5]/10 border border-[#42C8D5]/25 flex items-center justify-center mx-auto mb-3.5 text-[#42C8D5]">
                <MessageSquare className="h-6 w-6 stroke-[1.8]" />
              </div>
              <p className="font-semibold text-sm text-[#EDE7DC]">No conversations yet</p>
              <p className="mt-1.5 text-[#9EA5A8] text-[12px] leading-relaxed">
                Ask a question to start your first session.
              </p>
              <button
                className="mt-5 inline-flex items-center gap-1.5 h-9.5 px-4 rounded-xl border border-[rgba(237,231,220,0.2)] bg-[#101317] hover:bg-[#161B22] text-[#EDE7DC] text-xs font-medium transition-all cursor-pointer shadow-sm"
                onClick={() => startNewConversation()}
              >
                <Plus className="h-3.5 w-3.5 text-[#E8913C]" />
                <span>Start First Chat</span>
              </button>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#9EA5A8]">
              No matching conversations found
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = conv.id === activeConvId;
              const isRenaming = renamingId === conv.id;

              return (
                <div
                  key={conv.id}
                  onClick={() => !isRenaming && loadConversation(conv.id)}
                  className={`group relative flex items-center justify-between rounded-xl border text-left transition-all cursor-pointer ${
                    isActive
                      ? "border-[#42C8D5]/50 bg-[#161D24] text-[#EDE7DC] font-medium shadow-sm"
                      : "border-[rgba(237,231,220,0.1)] bg-[#0A0C0E]/60 hover:bg-[#13171D] hover:border-[rgba(237,231,220,0.25)] text-[#9EA5A8] hover:text-[#EDE7DC]"
                  }`}
                  style={{ padding: "13px 15px" }}
                >
                  {isRenaming ? (
                    <form
                      onSubmit={(e) => handleRename(e, conv.id)}
                      className="flex-1 flex items-center gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        autoFocus
                        value={renameTitle}
                        onChange={(e) => setRenameTitle(e.target.value)}
                        className="h-7 text-xs rounded-lg px-2 bg-[#0A0C0E] border border-[#E8913C] text-[#EDE7DC] flex-1 focus:outline-none"
                        onBlur={() => setRenamingId(null)}
                      />
                      <button
                        type="submit"
                        className="h-7 px-2.5 text-xs bg-[#E8913C] text-[#0A0C0E] font-semibold rounded-lg"
                      >
                        Save
                      </button>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-center gap-2.5 min-w-0 pr-2 flex-1">
                        <MessageSquare
                          className={`h-4 w-4 shrink-0 ${
                            isActive ? "text-[#42C8D5]" : "text-[#9EA5A8]"
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="truncate text-xs sm:text-[13px] font-medium text-[#EDE7DC]">
                            {conv.title || "Untitled Session"}
                          </div>
                          <div className="text-[11px] text-[#9EA5A8] truncate mt-0.5">
                            {conv.document_name
                              ? `Doc: ${conv.document_name}`
                              : "All documents"}{" "}
                            • {conv.updated_at ? new Date(conv.updated_at).toLocaleDateString() : ""}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingId(conv.id);
                            setRenameTitle(conv.title);
                          }}
                          className="text-[#9EA5A8] hover:text-[#EDE7DC] p-1 rounded hover:bg-[#101317]"
                          title="Rename chat"
                          aria-label="Rename chat"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) =>
                            handleDeleteConversation(e, conv.id, conv.title)
                          }
                          className="text-[#9EA5A8] hover:text-[#E5484D] p-1 rounded hover:bg-[#101317]"
                          title="Delete chat"
                          aria-label="Delete chat"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ====================================================================
          MAIN CHAT WORKSPACE: AI DOCUMENT INTELLIGENCE
          ==================================================================== */}
      <section className="flex-1 min-w-0 flex flex-col bg-[#101317] border border-[rgba(237,231,220,0.12)] rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.3)] relative">
        {/* Workspace Header: ALWAYS on one single row, controls never wrap below heading */}
        <header
          className="border-b border-[rgba(237,231,220,0.1)] bg-[#0D1013] flex items-center justify-between gap-3 sm:gap-4 shrink-0 flex-nowrap"
          style={{ padding: "18px 24px" }}
        >
          {/* Left Title & Icon */}
          <div className="flex items-center gap-3 min-w-0 shrink">
            {/* Mobile Sidebar Toggle Button */}
            <button
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              className="md:hidden h-9 px-3 rounded-xl border border-[rgba(237,231,220,0.18)] bg-[#0A0C0E] text-[#EDE7DC] text-xs font-medium flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Toggle Conversations"
            >
              <MessageSquare className="h-4 w-4 text-[#E8913C]" />
              <span className="hidden sm:inline">Chats</span>
            </button>

            <div className="w-10 h-10 rounded-xl bg-[#42C8D5]/15 border border-[#42C8D5]/35 text-[#42C8D5] flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(66,200,213,0.15)]">
              <Zap className="h-5 w-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <h3 className="font-['Syne',sans-serif] text-base sm:text-lg font-bold text-[#EDE7DC] truncate">
                Document Intelligence
              </h3>
              <p className="text-[11.5px] text-[#9EA5A8] mt-0.5 truncate hidden sm:block">
                Grounded answers with vector chunk citations
              </p>
            </div>
          </div>

          {/* Right Controls: Single row beside heading, no wrapping */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 flex-nowrap">
            {/* Scope Toggle: Current Document vs All Documents with rounded colored active pill & theme border */}
            <div
              className="inline-flex rounded-full border border-[rgba(237,231,220,0.18)] bg-[#080B0D] items-center shrink-0"
              style={{ padding: "4px 5px", gap: "6px" }}
            >
              <button
                type="button"
                onClick={() => setScope("current")}
                className={`rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  scope === "current"
                    ? "bg-[#181D23] text-[#E8913C] border border-[#E8913C]/80 shadow-[0_0_12px_rgba(232,145,60,0.25)]"
                    : "text-[#9EA5A8] border border-transparent hover:text-[#EDE7DC] hover:bg-[#12161C]"
                }`}
                style={{ paddingLeft: "15px", paddingRight: "15px", paddingTop: "6px", paddingBottom: "6px" }}
              >
                Current Document
              </button>
              <button
                type="button"
                onClick={() => setScope("all")}
                className={`rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  scope === "all"
                    ? "bg-[#181D23] text-[#E8913C] border border-[#E8913C]/80 shadow-[0_0_12px_rgba(232,145,60,0.25)]"
                    : "text-[#9EA5A8] border border-transparent hover:text-[#EDE7DC] hover:bg-[#12161C]"
                }`}
                style={{ paddingLeft: "15px", paddingRight: "15px", paddingTop: "6px", paddingBottom: "6px" }}
              >
                All Documents
              </button>
            </div>

            {/* Document Select Dropdown: inline on the SAME row */}
            {scope === "current" && (
              <div className="relative inline-flex items-center shrink-0">
                <select
                  id="chat-scope-select"
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="h-9 w-[160px] sm:w-[190px] lg:w-[220px] appearance-none rounded-xl border border-[rgba(237,231,220,0.18)] bg-[#0A0C0E] text-xs font-medium text-[#EDE7DC] focus:border-[#E8913C] focus:outline-none cursor-pointer truncate"
                  style={{ paddingLeft: "12px", paddingRight: "32px" }}
                >
                  {documents.length === 0 ? (
                    <option value="" className="bg-[#101317] text-[#9EA5A8]">No documents found</option>
                  ) : (
                    <>
                      {(!selectedDocId || !attachedDoc) && (
                        <option value="" className="bg-[#101317] text-[#9EA5A8]">Select document...</option>
                      )}
                      {documents.map((doc) => (
                        <option key={doc.id} value={doc.id} className="bg-[#101317] text-[#EDE7DC]">
                          {doc.filename}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9EA5A8]" />
              </div>
            )}

            {/* Clear Messages Action */}
            {messages.length > 0 && (
              <button
                onClick={handleClearMessages}
                className="h-9 px-3 rounded-xl border border-[rgba(237,231,220,0.18)] bg-[#0A0C0E] hover:bg-[#E5484D]/10 hover:border-[#E5484D]/40 text-[#9EA5A8] hover:text-[#E5484D] text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                title="Clear messages in this session"
              >
                <Eraser className="h-3.5 w-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </header>

        {/* Chat Messages Scroll Container: ample top margin from header line and right padding */}
        <div
          className="flex-1 overflow-y-auto bg-[#101317]"
          style={{
            paddingTop: "26px",
            paddingBottom: "24px",
            paddingLeft: "28px",
            paddingRight: "28px",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          {isLoadingHistory ? (
            <div className="flex h-full items-center justify-center text-[#9EA5A8]">
              <Loader2 className="h-6 w-6 animate-spin mr-2 text-[#E8913C]" />
              <span className="text-sm">Loading conversation history...</span>
            </div>
          ) : messages.length === 0 ? (
            /* Centered Empty State */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-full text-center text-[#9EA5A8] max-w-xl mx-auto py-8 my-auto"
            >
              {/* Glowing Aura Illustration */}
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#42C8D5]/20 via-[#42C8D5]/10 to-[#E8913C]/20 border border-[rgba(237,231,220,0.15)] flex items-center justify-center text-[#42C8D5] shadow-[0_0_28px_rgba(66,200,213,0.18)] mb-4">
                <Sparkles className="h-8 w-8 stroke-[1.8]" />
              </div>

              <h3 className="font-['Syne',sans-serif] text-2xl sm:text-3xl font-bold text-[#EDE7DC]">
                Ask anything about your documents
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-[#9EA5A8] leading-relaxed max-w-md">
                DocuQuery extracts semantically matching chunks from your files
                and answers your questions with precise citations.
              </p>

              {/* Centered Suggested Prompt Chips */}
              <div className="mt-8 w-full max-w-xl mx-auto space-y-3">
                <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#9EA5A8] text-center font-semibold">
                  SUGGESTED PROMPTS
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => handlePromptClick(prompt)}
                      className="rounded-xl border border-[rgba(237,231,220,0.14)] bg-[#0A0C0E] hover:bg-[#141920] hover:border-[#E8913C]/60 text-xs sm:text-[13px] text-[#EDE7DC] transition-all text-center cursor-pointer shadow-sm group flex flex-col items-center justify-center gap-2"
                      style={{ padding: "16px 20px" }}
                    >
                      <span className="text-base group-hover:scale-110 transition-transform">
                        💡
                      </span>
                      <span className="leading-relaxed text-center font-medium">
                        {prompt}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            messages.map((msg) => <MessageItem key={msg.id} msg={msg} />)
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Anchored Input Composer Area */}
        <div
          className="border-t border-[rgba(237,231,220,0.1)] space-y-3.5 bg-[#0C0F12] shrink-0"
          style={{ padding: "20px 24px 20px 24px" }}
        >
          {/* Scoped Context Document Attachment Chip */}
          {scope === "current" && attachedDoc && (
            <div
              className="inline-flex items-center justify-between gap-3 rounded-xl border border-[rgba(237,231,220,0.18)] bg-[#101317] max-w-md shadow-sm"
              style={{ padding: "8px 16px", marginBottom: "6px" }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="h-4 w-4 text-[#42C8D5] shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[#EDE7DC] truncate">
                    {attachedDoc.filename}
                  </div>
                  <div className="text-[10px] text-[#9EA5A8] font-mono uppercase tracking-wider">
                    Scoped Context Document
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveAttachment}
                className="text-[#9EA5A8] hover:text-[#EDE7DC] p-1 rounded-lg hover:bg-[#161B22] transition-colors cursor-pointer"
                aria-label="Remove attachment"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Multiline Composer Form */}
          <form onSubmit={handleSubmit}>
            <div
              className="flex items-end gap-3 rounded-2xl border border-[rgba(237,231,220,0.18)] bg-[#0A0C0E] focus-within:border-[#E8913C] focus-within:ring-1 focus-within:ring-[#E8913C]/40 shadow-inner transition-all"
              style={{ padding: "10px 16px" }}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={
                  scope === "current" && attachedDoc
                    ? `Ask about ${attachedDoc.filename}... (Enter to send)`
                    : "Ask across all documents... (Enter to send)"
                }
                className="w-full bg-transparent text-xs sm:text-[14px] text-[#EDE7DC] placeholder-[#6C7378] focus:outline-none resize-none min-h-[42px] max-h-[140px] py-1.5 leading-relaxed"
                disabled={isLoading}
              />
              <button
                type="submit"
                className="h-10 w-10 rounded-xl bg-[#E8913C] hover:bg-[#f39c4a] text-[#0A0C0E] flex items-center justify-center shrink-0 disabled:opacity-35 disabled:hover:bg-[#E8913C] cursor-pointer transition-all shadow-sm mb-0.5 active:scale-95"
                disabled={isLoading || !input.trim()}
                title="Send message (Enter)"
              >
                {isLoading ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin text-[#0A0C0E]" />
                ) : (
                  <Send className="h-4.5 w-4.5 stroke-[2.2]" />
                )}
              </button>
            </div>
          </form>

          {/* Footer Hints */}
          <div
            className="flex items-center justify-between text-[11px] text-[#6C7378] px-1 font-sans"
            style={{ paddingTop: "4px" }}
          >
            <span>Powered by Gemini &amp; Sentence-Transformers RAG</span>
            <span className="hidden sm:inline">Shift + Enter for multiline • Enter to send</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function MessageItem({ msg }: { msg: ChatMessage }) {
  const [copied, setCopied] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(true);

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  if (msg.from === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end"
      >
        <div className="max-w-2xl space-y-1.5" style={{ marginRight: "12px" }}>
          <div
            className="rounded-2xl rounded-tr-sm bg-[#E8913C] text-[#0A0C0E] font-medium shadow-md text-xs sm:text-[14.5px]"
            style={{ padding: "14px 22px" }}
          >
            <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
          </div>
          {msg.created_at && (
            <div className="text-[11px] text-[#9EA5A8] text-right pr-2">
              {new Date(msg.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // AI turn
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3.5"
    >
      <div className="w-9 h-9 shrink-0 rounded-xl bg-[#42C8D5]/15 border border-[#42C8D5]/35 text-[#42C8D5] flex items-center justify-center mt-1 shadow-sm">
        <Zap className="h-4.5 w-4.5 stroke-[2.2]" />
      </div>
      <div
        className="max-w-2xl flex-1"
        style={{ display: "flex", flexDirection: "column", gap: "16px" }}
      >
        {/* Loading state */}
        {msg.loading && (
          <div
            className="rounded-2xl rounded-tl-sm border border-[rgba(237,231,220,0.12)] bg-[#0A0C0E] text-xs sm:text-sm shadow-sm"
            style={{ padding: "20px 24px" }}
          >
            <div className="flex items-center gap-2.5 text-[#9EA5A8]">
              <Loader2 className="h-4.5 w-4.5 animate-spin text-[#E8913C]" />
              <span>Retrieving relevant context and generating answer...</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {msg.error && (
          <div
            className="rounded-2xl rounded-tl-sm border border-[#E5484D]/30 bg-[#E5484D]/10 text-xs sm:text-sm text-[#EDE7DC] shadow-sm"
            style={{ padding: "20px 24px" }}
          >
            <div className="flex items-start gap-2.5 text-[#E5484D]">
              <AlertCircle className="h-4.5 w-4.5 mt-0.5 shrink-0" />
              <span>{msg.error}</span>
            </div>
          </div>
        )}

        {/* Response Content Bubble with generous vertical padding */}
        {msg.content && (
          <div
            className="group relative rounded-2xl rounded-tl-sm border border-[rgba(237,231,220,0.13)] bg-[#0A0C0E] text-xs sm:text-[14.5px] text-[#EDE7DC] shadow-sm"
            style={{ padding: "22px 26px" }}
          >
            <p className="whitespace-pre-wrap leading-[1.75]">{msg.content}</p>

            <div
              className="flex items-center justify-between border-t border-[rgba(237,231,220,0.08)] text-[11.5px] text-[#9EA5A8]"
              style={{ marginTop: "18px", paddingTop: "14px" }}
            >
              <span>
                {msg.created_at
                  ? new Date(msg.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : ""}
              </span>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[#9EA5A8] hover:text-[#EDE7DC] hover:bg-[#161B22] border border-[rgba(237,231,220,0.1)] transition-all cursor-pointer"
                title="Copy response"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#34D399]" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Sources & Citations with spacious layout */}
        {msg.sources && msg.sources.length > 0 && (
          <div
            className="w-full"
            style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "10px" }}
          >
            <button
              onClick={() => setSourcesOpen(!sourcesOpen)}
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#9EA5A8] hover:text-[#EDE7DC] transition-colors cursor-pointer w-fit"
            >
              {sourcesOpen ? (
                <ChevronDown className="h-3.5 w-3.5 text-[#42C8D5]" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-[#42C8D5]" />
              )}
              <span>Sources &amp; Citations ({msg.sources.length})</span>
            </button>

            <AnimatePresence>
              {sourcesOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ display: "flex", flexDirection: "column", gap: "12px" }}
                >
                  {msg.sources.map((source, i) => (
                    <div
                      key={`${source.document_id}-${source.chunk_index}-${i}`}
                      className="rounded-xl border border-[rgba(237,231,220,0.12)] bg-[#141920] text-xs transition-all hover:border-[#42C8D5]/50 shadow-sm"
                      style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "12px" }}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 font-medium text-[#EDE7DC] truncate">
                          <FileText className="h-4 w-4 text-[#42C8D5] shrink-0" />
                          <span className="truncate text-[13px] font-semibold">
                            {source.document_name ||
                              `Document ${source.document_id.slice(0, 8)}`}
                          </span>
                          <span className="text-[#9EA5A8] text-[11.5px] font-mono shrink-0">
                            • Chunk #{source.chunk_index}
                          </span>
                        </div>
                        <span className="rounded-full border border-[#34D399]/40 bg-[#064E3B]/40 px-2.5 py-0.5 text-[11px] font-semibold text-[#34D399] shrink-0">
                          {(source.score * 100).toFixed(1)}% match
                        </span>
                      </div>

                      {source.content && (
                        <p
                          className="text-[#9EA5A8] line-clamp-3 bg-[#0A0C0E] border border-[rgba(237,231,220,0.06)] rounded-lg text-[12px] font-mono italic"
                          style={{ padding: "12px 14px", lineHeight: "1.7" }}
                        >
                          "{source.content.trim()}"
                        </p>
                      )}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

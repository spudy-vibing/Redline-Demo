import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import {
  Send, Bot, User, Database, Sparkles,
  Code, ExternalLink, Loader2, MessageSquare, Terminal
} from 'lucide-react'
import { clsx } from 'clsx'
import { sendChatMessage, type ChatMessage, type ChatResponse, type ChatSource } from '../services/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
  cypherQuery?: string
  sources?: ChatSource[]
  generatedBy?: 'claude' | 'template'
}

const EXAMPLE_QUESTIONS = [
  "Who are Huawei's subsidiaries?",
  "Which companies are on the Entity List?",
  "Show me semiconductor companies",
  "Which companies are captured by BIS 50%?",
  "Tell me about DeepSeek",
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [showCypher, setShowCypher] = useState<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const history: ChatMessage[] = messages.map(m => ({
        role: m.role,
        content: m.content
      }))
      return sendChatMessage(message, history)
    },
    onSuccess: (data: ChatResponse) => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        cypherQuery: data.cypher_query,
        sources: data.sources,
        generatedBy: data.generated_by
      }])
    },
    onError: (error) => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }])
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || chatMutation.isPending) return

    const userMessage = input.trim()
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setInput('')
    chatMutation.mutate(userMessage)
  }

  const handleExampleClick = (question: string) => {
    setInput(question)
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-lg bg-redline-500/10 border border-redline-500/30 flex items-center justify-center">
          <MessageSquare className="w-6 h-6 text-redline-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Knowledge Graph Chat</h1>
          <p className="text-sm text-neutral-500">
            Ask questions about entities, sanctions, and ownership relationships
          </p>
        </div>
      </div>

      {/* The redline divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-redline-500/50 to-transparent mb-6" />

      {/* Chat Container */}
      <div className="flex-1 bg-neutral-900/60 backdrop-blur-sm border border-neutral-800 rounded-lg overflow-hidden flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-redline-500/20 to-redline-500/5 border border-redline-500/20 flex items-center justify-center mb-6">
                <Bot className="w-8 h-8 text-redline-400" />
              </div>
              <h2 className="text-lg font-medium text-neutral-200 mb-2">
                Query the knowledge graph
              </h2>
              <p className="text-neutral-500 text-sm max-w-md mb-8">
                Ask about entities, sanctions, ownership structures, and compliance risks in natural language.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {EXAMPLE_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleExampleClick(q)}
                    className="px-3 py-1.5 text-sm bg-neutral-800/50 text-neutral-400 rounded-lg border border-neutral-700/50 hover:bg-neutral-700/50 hover:text-redline-400 hover:border-redline-500/30 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={clsx(
                  'flex gap-3 animate-slide-up',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-redline-500/20 to-redline-500/5 border border-redline-500/20 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-redline-400" />
                  </div>
                )}

                <div
                  className={clsx(
                    'max-w-[80%] rounded-lg px-4 py-3',
                    message.role === 'user'
                      ? 'bg-redline-500/10 border border-redline-500/30 text-neutral-200'
                      : 'bg-neutral-800/50 border border-neutral-700/50 text-neutral-300'
                  )}
                >
                  {/* Message content */}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {message.content}
                  </p>

                  {/* Assistant metadata */}
                  {message.role === 'assistant' && (
                    <div className="mt-3 pt-3 border-t border-neutral-700/30 space-y-2">
                      {/* Generated by badge */}
                      <div className="flex items-center gap-2 text-xs">
                        {message.generatedBy === 'claude' ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-redline-500/10 text-redline-400 border border-redline-500/20">
                            <Sparkles className="w-3 h-3" />
                            AI-Powered
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-700/30 text-neutral-400 border border-neutral-600/30">
                            <Database className="w-3 h-3" />
                            Direct Query
                          </span>
                        )}

                        {/* Cypher query toggle */}
                        {message.cypherQuery && (
                          <button
                            onClick={() => setShowCypher(showCypher === index ? null : index)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-700/50 text-neutral-400 hover:text-redline-400 transition-colors"
                          >
                            <Code className="w-3 h-3" />
                            {showCypher === index ? 'Hide' : 'Show'} Cypher
                          </button>
                        )}
                      </div>

                      {/* Cypher query */}
                      {showCypher === index && message.cypherQuery && (
                        <div className="bg-neutral-900/80 rounded-lg p-3 font-mono text-xs text-neutral-400 overflow-x-auto border border-neutral-700/30">
                          <div className="flex items-center gap-2 text-neutral-500 mb-2">
                            <Terminal className="w-3 h-3" />
                            <span className="uppercase tracking-wider text-[10px]">Cypher Query</span>
                          </div>
                          <pre className="text-redline-400/80">{message.cypherQuery}</pre>
                        </div>
                      )}

                      {/* Sources */}
                      {message.sources && message.sources.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {message.sources.map((source, i) => (
                            <Link
                              key={i}
                              to={`/entity/${source.entity_id}`}
                              className="flex items-center gap-1 px-2 py-0.5 text-xs bg-neutral-700/30 text-neutral-400 rounded hover:text-redline-400 hover:bg-neutral-700/50 transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                              {source.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-neutral-400" />
                  </div>
                )}
              </div>
            ))
          )}

          {/* Loading indicator */}
          {chatMutation.isPending && (
            <div className="flex gap-3 animate-slide-up">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-redline-500/20 to-redline-500/5 border border-redline-500/20 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-redline-400" />
              </div>
              <div className="bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-neutral-400">
                  <Loader2 className="w-4 h-4 animate-spin text-redline-400" />
                  Querying knowledge graph...
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-neutral-800/50 p-4 bg-neutral-900/30">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about entities, sanctions, ownership..."
              className="flex-1 bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-4 py-3 text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-redline-500/50 focus:ring-1 focus:ring-redline-500/20 transition-colors"
              disabled={chatMutation.isPending}
            />
            <button
              type="submit"
              disabled={!input.trim() || chatMutation.isPending}
              className={clsx(
                'px-5 py-3 rounded-lg font-medium flex items-center gap-2 transition-all',
                input.trim() && !chatMutation.isPending
                  ? 'bg-redline-600 hover:bg-redline-500 text-white shadow-lg shadow-redline-500/20'
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
              )}
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

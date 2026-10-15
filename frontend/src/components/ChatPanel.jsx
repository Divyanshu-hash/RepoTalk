import { useState, useRef, useEffect } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuth } from '../context/AuthContext'
import { useRepo } from '../context/RepoContext'

export default function ChatPanel({ apiBase }) {
  const { token } = useAuth()
  const { chatHistory, chatHistoryLoading } = useRepo()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  // Seed messages from persisted chat history when it loads
  useEffect(() => {
    if (chatHistory && chatHistory.length > 0) {
      setMessages(chatHistory.map(m => ({ role: m.role, content: m.content })))
    }
  }, [chatHistory])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  const sendMessage = async (queryText) => {
    const query = queryText || input.trim()
    if (!query || loading) return

    const userMsg = { role: 'user', content: query }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(`${apiBase}/repo/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ query })
      })
      const data = await res.json()

      if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ ' + data.error }])
      } else {
        let response = data.answer
        if (data.mode === 'issue-aware' && data.issue) {
          response = `**Issue #${data.issue.number}: ${data.issue.title}**\n\n${response}`
        }
        setMessages(prev => [...prev, { role: 'assistant', content: response }])
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Failed to get response. Please try again.' }])
    }

    setLoading(false)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    sendMessage()
  }

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {/* History loading state */}
        {chatHistoryLoading && (
          <div className="chat-history-loading">
            <div className="thinking-dots">
              <span></span><span></span><span></span>
            </div>
            <span>Loading previous conversation…</span>
          </div>
        )}

        {/* Welcome screen — only if no history and not loading */}
        {!chatHistoryLoading && messages.length === 0 && (
          <div className="chat-welcome-wiki">
            <div className="chat-welcome-header">
            </div>
            <div className="chat-welcome-content">
              <div className="chat-welcome-logo">
                <div></div>
                <div></div>
                <div></div>
              </div>
              <h2>Hi there!</h2>
              <p>Ask me any questions about the codebase</p>
            </div>
          </div>
        )}

        {/* History separator when restoring old messages */}
        {!chatHistoryLoading && messages.length > 0 && chatHistory.length > 0 && (
          <div className="chat-history-divider">
            <span>Previous conversation</span>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.role === 'assistant' && (
              <div className="message-role-label">RepoTalk</div>
            )}
            <div className="message-body">
              {msg.role === 'assistant' ? (
                <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="thinking-indicator">
            <div className="thinking-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-footer-wiki">
        <form onSubmit={handleSubmit} className="chat-input-pill">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this repository"
            disabled={loading}
          />
          <button type="submit" className="send-btn-wiki" disabled={loading || !input.trim()}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
        <p className="chat-disclaimer">RepoTalk can make mistakes, so double-check it.</p>
      </div>
    </div>
  )
}

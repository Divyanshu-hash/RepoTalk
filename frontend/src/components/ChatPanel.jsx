import { useState, useRef, useEffect } from 'react'
import Markdown from 'react-markdown'

export default function ChatPanel({ apiBase }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

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
      const res = await fetch(`${apiBase}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const suggestions = [
    "What does this project do?",
    "Explain the main architecture",
    "What are the key files?",
    "How does the data flow work?",
    "What dependencies are used?",
    "Suggest improvements",
  ]

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-welcome">
            <div className="welcome-icon">💬</div>
            <h3>Chat with this Repository</h3>
            <p>Ask anything about the codebase — architecture, specific files, functions, issues, and more.</p>
            <div className="chat-suggestions">
              {suggestions.map((s, i) => (
                <button 
                  key={i} 
                  className="suggestion-chip"
                  onClick={() => sendMessage(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <div className="message-avatar">
              {msg.role === 'user' ? '👤' : '🤖'}
            </div>
            <div className="message-body">
              {msg.role === 'assistant' ? (
                <Markdown>{msg.content}</Markdown>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="thinking-indicator">
            <div className="message-avatar" style={{ background: 'rgba(0,206,201,0.2)', border: '1px solid rgba(0,206,201,0.3)', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>
              🤖
            </div>
            <div className="thinking-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="chat-input-wrapper">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about the repository..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Send ↑
        </button>
      </form>
    </div>
  )
}

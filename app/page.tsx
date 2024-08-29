
'use client'
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';


// Function to get the current timestamp in "MM/DD/YYYY HH:MM:SS" format

const getCurrentTimestamp = () => {
  const now = new Date();
  const date = now.toLocaleDateString(); // e.g., "8/27/2024"
  const time = now.toLocaleTimeString(); // e.g., "2:15:30 PM"
  return `${date} ${time}`;
};

export default function Home() {
  const initialMessages = [
    {
      role: 'assistant',
      content: 'Hi! I\'m the ProfFinder support assistant. How can I help you today?',
      timestamp: getCurrentTimestamp(), // Add initial timestamp
    },
  ];

  const [messages, setMessages] = useState(initialMessages);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!message.trim()) return; // Avoid sending empty messages

    const userMessage = { role: 'user', content: message, timestamp: getCurrentTimestamp() };
    const assistantMessage = { role: 'assistant', content: '', timestamp: '' };

    setLoading(true);
    setMessage(''); // Clear the input field

    setMessages((prevMessages) => [
      ...prevMessages,
      userMessage,
      assistantMessage,
    ]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([...messages, userMessage]),
      });

      if (!res.body || !(res.body instanceof ReadableStream)) {
        throw new Error('Invalid response body');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let result = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value || new Uint8Array(), { stream: true });
        result += text;

        setMessages((prevMessages) => {
          const newMessages = [...prevMessages];
          const lastMessage = newMessages.pop();
          if (lastMessage && lastMessage.role === 'assistant') {
            newMessages.push({ ...lastMessage, content: lastMessage.content + text, timestamp: getCurrentTimestamp() });
          } else {
            newMessages.push({ role: 'assistant', content: text, timestamp: getCurrentTimestamp() }); // Fallback if lastMessage is undefined
          }
          return newMessages;
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRateMyProfessorRedirect = () => {
    window.open('https://www.ratemyprofessors.com/', '_blank');
  };

  const handleClearChat = () => {
    setMessages(initialMessages);
  };

  return (
    <Box
      width="100vw"
      height="100vh"
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      bgcolor="white" // Set the background color to white
    >
      <Stack
        direction="column"
        width="500px"
        height="700px"
        border="1px solid black"
        bgcolor="white" // Set the chat container background to white
        p={2}
        spacing={3}
        borderRadius={2} // Optional: Add rounded corners
      >
        <Box
          bgcolor="primary.main" // Header background color
          color="white"
          p={2}
          borderRadius="8px 8px 0 0" // Rounded top corners
          textAlign="center"
          display="flex"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography variant="h6">ProfFinder</Typography>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleRateMyProfessorRedirect}
          >
            Rate My Professor
          </Button>
        </Box>

        <Stack
          direction="column"
          spacing={2}
          flexGrow={1}
          overflow="auto"
          maxHeight="100%"
        >
          {messages.map((msg, index) => (
            <Box
              key={index}
              display="flex"
              flexDirection="column"
              justifyContent={msg.role === 'assistant' ? 'flex-start' : 'flex-end'}
            >
              <Box
                bgcolor={msg.role === 'assistant' ? 'primary.main' : 'secondary.main'}
                color="white"
                borderRadius={16}
                p={2}
                maxWidth="80%" // Ensure messages don’t stretch too wide
                sx={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }} // Handle long words or URLs and preserve formatting
              >
                {/* Render content with proper formatting */}
                {msg.content.split('\n').map((line, i) => (
                  <Typography key={i} variant="body2" color="inherit">
                    {line}
                  </Typography>
                ))}
              </Box>
              <Typography
                variant="caption"
                color="textSecondary"
                align={msg.role === 'assistant' ? 'left' : 'right'}
                sx={{ mt: 0.5 }}
              >
                {msg.timestamp}
              </Typography>
            </Box>
          ))}
        </Stack>
        
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            label="Message"
            fullWidth
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              onClick={sendMessage}
              disabled={loading}
            >
              Send
            </Button>
            <Button
              variant="outlined"
              color="primary"
              onClick={handleClearChat}
            >
              Clear Chat
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Box>
  );
}
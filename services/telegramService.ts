
export const sendTelegramMessage = async (
  botToken: string,
  chatId: string,
  widgetName: string,
  channel: string,
  value: string
) => {
  const text = `
<b>🚀 New Feedback Received!</b>

<b>Widget:</b> ${widgetName}
<b>Source:</b> ${channel.toUpperCase()}
<b>Contact Detail:</b> <code>${value}</code>

<i>Timestamp: ${new Date().toLocaleString()}</i>
  `.trim();

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.description || 'Failed to send message to Telegram');
    }

    return true;
  } catch (error) {
    console.error('Telegram API Error:', error);
    throw error;
  }
};

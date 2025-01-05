export async function greetingMessage(ctx) {
	await ctx.replyWithMarkdownV2(
	`
🌟 *Welcome to our Telegram bot\\!* 🌟

This bot is designed for convenient interaction with various AI models, such as ChatGPT and DeepSeek\\. We will help you get answers to your questions quickly and efficiently\\.

📢 *Our channels\\:*
[OCGWilbemaxZ9t](https://t.me/OCGWilbemaxZ9t)
[Wilbemax](https://t.me/wbmdev)
[Z9TOWNERCODE](https://t.me/OCGWilbemaxZ9t)
Here you will find useful materials, updates, and news about the project\\.

👨‍💻 *Creators:*
\\- Wilbemax
\\- Z9T

To continue, please subscribe to our channels and choose the model you want to work with\\.
		`,
	);
}

import { OpenAI } from 'openai';

const baseURL = 'https://api.aimlapi.com/v1';
const apiKey = process.env.AI_ML_KEY;
const promt = 'You are a ha helpful assistant';
const api = new OpenAI({
	apiKey,
	baseURL,
});

export const mistralAi = async (message, ctx) => {
	try {
		const completion = await api.chat.completions.create({
			model: 'mistralai/Mistral-7B-Instruct-v0.2',
			messages: [
				{
					role: 'system',
					content: promt,
				},
				{
					role: 'user',
					content: message,
				},
			],
			temperature: 0.7,
			max_tokens: 256,
		});

		let response = completion.choices[0].message.content;

		// Экранируем специальные символы
		response = response.replace(/([_*[\]()~`>#+=|{}.!-])/g, '\\$1');

		// Проверяем длину сообщения
		if (response.length > 4096) {
			const parts = response.match(/.{1,4000}/g);
			for (const part of parts) {
				await ctx.replyWithMarkdown(part);
			}
		} else {
			await ctx.replyWithMarkdown(response);
		}
	} catch (error) {
		console.error(error);
		await ctx.reply('An error occurred, try it again later');
	}
};

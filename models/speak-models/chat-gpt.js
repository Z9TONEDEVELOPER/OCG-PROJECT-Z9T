export const chatGptModel = async (ctx, client) => {
	try {
		const stream = await client.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: [
				{ role: 'system', content: 'You are a helpful assistant.' },
				{ role: 'user', content: ctx.message.text },
			],
			stream: false,
		});
        
		const answer = stream.choices[0]?.message?.content || '';

		await ctx.replyWithMarkdown(answer);
	} catch (error) {
		console.error('Error:', error);
		await ctx.reply(
			'Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже.'
		);
	}
};

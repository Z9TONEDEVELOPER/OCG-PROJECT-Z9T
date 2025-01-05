export async function checkSubscription(ctx) {
	const userId = ctx.from.id;
	const channelIds = ['@wbmdev', '@OCGWilbemaxZ9t', '@z9townercode'];

	try {
		const memberStatuses = await Promise.all(
			channelIds.map(async (channelId) => {
				const member = await ctx.telegram.getChatMember(channelId, userId);
				return member.status;
			})
		);

		if (!memberStatuses.includes('left')) {
			ctx.session.isSubscribed = true;
			return true;
		} else {
			await ctx.reply(
				'Пожалуйста, подпишитесь на наш канал, чтобы продолжить.',
				{
					reply_markup: {
						inline_keyboard: channelIds.map((channelId) => [
							{
								text: `Подписаться на канал ${channelId}`,
								url: `https://t.me/${channelId.replace('@', '')}`,
							},
						]),
					},
				}
			);
			ctx.session.isSubscribed = false;
			return false;
		}
	} catch (error) {
		console.error('Ошибка проверки подписки:', error);
		await ctx.reply('Не удалось проверить подписку. Попробуйте позже.');
		ctx.session.isSubscribed = false;
		return false;
	}
}

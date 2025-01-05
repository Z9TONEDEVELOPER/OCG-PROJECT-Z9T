import fs from 'fs';
import { Telegraf, Markup, Scenes, session } from 'telegraf';
import { getTokens } from './helpers/tokens.js';
import { greetingMessage } from './helpers/greeting-message.js';
import { checkSubscription } from './helpers/check-subscription.js';
import { chatGptModel, mistralAi } from './models/speak-models/index.js';
import { stableDefusion } from './models/images-models/stable-defusion.js';
import { generateImage } from './models/images-models/dalle.js';
import { googleGemeni } from './models/speak-models/google.js';
import { claudeModel } from './models/speak-models/claude.js';

const { telegramToken, proxyAPI, proxyUrl } = getTokens();

const bot = new Telegraf(telegramToken);
bot.use(
    session({
        defaultSession: () => ({
            isSubscribed: false,
        }),
    })
);

// --- Сцена выбора языковой модели ---
const modelSelectionScene = new Scenes.BaseScene('modelSelection');

modelSelectionScene.enter((ctx) => {
    ctx.replyWithMarkdownV2(
        'Chose model:',
        Markup.inlineKeyboard([
            [Markup.button.callback('Chat-GPT', 'Chat-GPT')],
            [Markup.button.callback('Stable Diffusion', 'Stable-Diffusion')],
            [Markup.button.callback('Mistralai', 'Mistralai')],
            [Markup.button.callback('Gemini 1.5 flash', 'Gemini-1.5-flash')],
            [Markup.button.callback('DALL·E', 'DALL-E')],
			[Markup.button.callback('Claude', 'Claude')],
            [Markup.button.callback('Add more...', 'Add more')],
        ])
    );
});

modelSelectionScene.action('Chat-GPT', (ctx) => {
    ctx.answerCbQuery();
    ctx.scene.enter('ChatGptScene');
});

modelSelectionScene.action('Stable-Diffusion', (ctx) => {
    ctx.answerCbQuery();
    ctx.scene.enter('StableDefusionScene');
});

modelSelectionScene.action('Mistralai', (ctx) => {
    ctx.answerCbQuery();
    ctx.scene.enter('MistralaiScene');
});

modelSelectionScene.action('Gemini-1.5-flash', (ctx) => {
    ctx.answerCbQuery();
    ctx.scene.enter('Gemini15FlashScene');
});

modelSelectionScene.action('DALL-E', (ctx) => {
    ctx.answerCbQuery();
    ctx.scene.enter('DalleScene');
});
modelSelectionScene.action('Claude', (ctx) => {
    ctx.answerCbQuery();
    ctx.scene.enter('ClaudeScene');
});

// --- Сцена GPT---
const ChatGptScene = new Scenes.BaseScene('ChatGptScene');

ChatGptScene.enter((ctx) => {
    const message = `*You have chosen the model: Chat\\-gpt \\(GPT\\-4o\\-mini\\)*  
To end the dialog, click the "end dialog" button  
Enter your request`;

    ctx.replyWithMarkdownV2(
        message,
        Markup.keyboard(['End dialog']).resize().oneTime()
    );
});

ChatGptScene.on('text', (ctx) => {
    if (ctx.message.text === 'End dialog') {
        ctx.scene.enter('modelSelection');
    } else {
        chatGptModel(ctx, ctx.from.id); // Передаём userId
    }
});

// --- Сцена StableDefusionScene---
const StableDefusionScene = new Scenes.BaseScene('StableDefusionScene');

StableDefusionScene.enter((ctx) => {
    const message = `*You have chosen the model: 'Stable Diffusion* \\ Please enter your image promt 
To end the dialog, click the "end dialog" button  
Enter your request`;

    ctx.replyWithMarkdownV2(
        message,
        Markup.keyboard(['End dialog']).resize().oneTime()
    );
});

StableDefusionScene.on('text', async (ctx) => {
    if (ctx.message.text === 'End dialog') {
        ctx.scene.enter('modelSelection');
    } else {
        try {
            // Вызываем stableDefusion и передаём ctx
            const imagePath = await stableDefusion(ctx.message.text, ctx);

            // Отправляем изображение пользователю
            await ctx.replyWithPhoto({ source: fs.createReadStream(imagePath) });
        } catch (error) {
            console.error('Error generating image:', error);
            await ctx.reply('Произошла ошибка при генерации изображения. Пожалуйста, попробуйте позже.');
        }
    }
});

// --- Сцена Mistralai---
const MistralaiScene = new Scenes.BaseScene('MistralaiScene');

MistralaiScene.enter((ctx) => {
    const message = `*You have chosen the model: 'Mistralai* \\ Please enter your image promt 
To end the dialog, click the "end dialog" button  
Enter your request`;

    ctx.replyWithMarkdownV2(
        message,
        Markup.keyboard(['End dialog']).resize().oneTime()
    );
});

MistralaiScene.on('text', async (ctx) => {
    if (ctx.message.text === 'End dialog') {
        ctx.scene.enter('modelSelection');
    } else {
        try {
            const response = await mistralAi(ctx.message.text, ctx.from.id); // Передаём userId
            await ctx.replyWithMarkdownV2(response);
        } catch (error) {
            console.error('Error:', error);
            await ctx.reply('Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже.');
        }
    }
});

// --- Сцена Gemini15FlashScene---




const Gemini15FlashScene = new Scenes.BaseScene('Gemini15FlashScene');

Gemini15FlashScene.enter((ctx) => {
    const message = `*You have chosen the model: 'Gemini 1\\.5 flash* \\ Please enter your image promt 
To end the dialog, click the "end dialog" button  
Enter your request`;

    ctx.replyWithMarkdownV2(
        message,
        Markup.keyboard(['End dialog']).resize().oneTime()
    );
});

Gemini15FlashScene.on('text', async (ctx) => {
    if (ctx.message.text === 'End dialog') {
        ctx.scene.enter('modelSelection');
    } else {
        try {
            // Передаём ctx в функцию googleGemeni
            await googleGemeni(ctx.message.text, ctx);
        } catch (error) {
            console.error('Error:', error);
            await ctx.reply('Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже.');
        }
    }
});

// --- Сцена DALL·E ---
const DalleScene = new Scenes.BaseScene('DalleScene');

DalleScene.enter((ctx) => {
    const message = `*You have chosen the model: DALL·E* \\ Please enter your image prompt 
To end the dialog, click the "end dialog" button  
Enter your request`;

    ctx.replyWithMarkdownV2(
        message,
        Markup.keyboard(['End dialog']).resize().oneTime()
    );
});

DalleScene.on('text', async (ctx) => {
    if (ctx.message.text === 'End dialog') {
        ctx.scene.enter('modelSelection');
    } else {
        try {
            const imageUrl = await generateImage(ctx.message.text, ctx.from.id); // Передаём userId
            await ctx.replyWithPhoto(imageUrl);
        } catch (error) {
            console.error('Error generating image:', error);
            await ctx.reply('Произошла ошибка при генерации изображения. Пожалуйста, попробуйте позже.');
        }
    }
});
//claude scene 
const ClaudeScene = new Scenes.BaseScene('ClaudeScene');

ClaudeScene.enter((ctx) => {
    const message = `*You have chosen the model: Claude*  
To end the dialog, click the "end dialog" button  
Enter your request`;

    ctx.replyWithMarkdownV2(
        message,
        Markup.keyboard(['End dialog']).resize().oneTime()
    );
});

ClaudeScene.on('text', async (ctx) => {
    if (ctx.message.text === 'End dialog') {
        ctx.scene.enter('modelSelection');
    } else {
        try {
            // Вызываем Claude и передаём ctx
            await claudeModel(ctx, ctx.message.text);
        } catch (error) {
            console.error('Error:', error);
            await ctx.reply('Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже.');
        }
    }
});


// --- Регистрация сцен ---
const stage = new Scenes.Stage([
    modelSelectionScene,
    ChatGptScene,
    StableDefusionScene,
    MistralaiScene,
    Gemini15FlashScene,
    DalleScene,
	ClaudeScene
]);

bot.use(stage.middleware());

bot.start(async (ctx) => {
    Markup.removeKeyboard();
    await greetingMessage(ctx);
    await checkSubscription(ctx);
    if (ctx.session.isSubscribed) {
        ctx.scene.enter('modelSelection');
    }
});

bot.launch();

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
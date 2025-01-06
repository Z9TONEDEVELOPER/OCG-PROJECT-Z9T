import fs from 'fs';
import { Telegraf, Markup, Scenes} from 'telegraf';
import { default as LocalSession } from 'telegraf-session-local';
import { getTokens } from './helpers/tokens.js';
import OpenAI from 'openai';
import { getGenerationLimits } from './helpers/admin-manager.js';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { greetingMessage } from './helpers/greeting-message.js';
import { checkSubscription } from './helpers/check-subscription.js';
import { chatGptModel, mistralAi } from './models/speak-models/index.js';
import { stableDefusion } from './models/images-models/stable-defusion.js';
import { generateImage } from './models/images-models/dalle.js';
import { googleGemeni } from './models/speak-models/google.js';
import { claudeModel } from './models/speak-models/claude.js';
import {
    isAdmin,
    addAdmin,
    removeAdmin,
    toggleMaintenanceMode,
    updateGenerationLimit,
    getMaintenanceMode,
} from './helpers/admin-manager.js';

const { telegramToken, proxyAPI, proxyUrl, openaiToken } = getTokens();
if (!telegramToken || !proxyAPI || !proxyUrl || !openaiToken) {
    console.error('Один или несколько токенов отсутствуют. Проверьте .env файл.');
    process.exit(1);
}

const agent = new SocksProxyAgent(proxyUrl);
const bot = new Telegraf(telegramToken);
const localSession = new LocalSession({
    database: 'sessions.json', // Файл для хранения сессий
    // Убрали storageFileAsync, так как он больше не поддерживается
    // Используем стандартное хранилище
});
function escapeMarkdownV2(text) {
    const reservedChars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
    return text.split('').map(char => reservedChars.includes(char) ? `\\${char}` : char).join('');
}
bot.use(localSession.middleware());


const client = new OpenAI({
    httpAgent: agent,
    apiKey: openaiToken,
});

// --- Сцена выбора языковой модели ---
const modelSelectionScene = new Scenes.BaseScene('modelSelection');

modelSelectionScene.enter((ctx) => {
    ctx.replyWithMarkdownV2(
        'Выберите модель:',
        Markup.inlineKeyboard([
            [Markup.button.callback('Chat-GPT', 'Chat-GPT')],
            [Markup.button.callback('Stable Diffusion', 'Stable-Diffusion')],
            [Markup.button.callback('Mistralai', 'Mistralai')],
            [Markup.button.callback('Gemini 1.5 flash', 'Gemini-1.5-flash')],
            [Markup.button.callback('DALL·E', 'DALL-E')],
            [Markup.button.callback('Claude', 'Claude')],
            [Markup.button.callback('Добавить больше...', 'Add more')],
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

// --- Сцена GPT ---
const ChatGptScene = new Scenes.BaseScene('ChatGptScene');

ChatGptScene.enter((ctx) => {
    const limits = getGenerationLimits(); // Получаем лимиты из admin.json
    const usedGenerations = ctx.session.generationCounts?.chatGpt || 0; // Использованные генерации
    const remainingGenerations = limits.chatGpt - usedGenerations; // Оставшиеся генерации
    const modelName = 'Chat-GPT (GPT-4o-mini)';

    const message = `<b>${modelName}</b>\n` +
        `Чтобы завершить диалог, нажмите кнопку "Завершить диалог".\n` +
        `Введите ваш запрос\n\n` +
        `<b>Лимит генераций:</b> ${limits.chatGpt}\n` +
        `<b>Осталось генераций:</b> ${remainingGenerations}`;

    ctx.replyWithHTML(
        message,
        Markup.keyboard(['Завершить диалог']).resize().oneTime()
    );
});

ChatGptScene.on('text', async (ctx) => {
    try {
        if (ctx.message.text === 'Завершить диалог') {
            ctx.scene.enter('modelSelection');
        } else {
            const limits = getGenerationLimits();
            const usedGenerations = ctx.session.generationCounts?.chatGpt || 0;

            // Проверяем, не превышен ли лимит
            if (usedGenerations >= limits.chatGpt) {
                await ctx.reply('Вы достигли лимита генераций для ChatGPT. Пожалуйста, выберите другую модель или попробуйте позже.');
                return;
            }

            // Выполняем генерацию
            await chatGptModel(ctx, client);

            // Увеличиваем счетчик использованных генераций
            ctx.session.generationCounts = ctx.session.generationCounts || {};
            ctx.session.generationCounts.chatGpt = (ctx.session.generationCounts.chatGpt || 0) + 1;

            // Сохраняем сессию (если используется telegraf-session-local, это происходит автоматически)
            console.log('Сессия после генерации:', ctx.session);

            // Отправляем обновленное сообщение с оставшимися генерациями
            const remainingGenerations = limits.chatGpt - ctx.session.generationCounts.chatGpt;
            await ctx.replyWithHTML(`<b>Осталось генераций:</b> ${remainingGenerations}`);
        }
    } catch (error) {
        console.error('Ошибка в ChatGptScene:', error);
        await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.');
        ctx.scene.enter('modelSelection'); // Возврат в начальную сцену
    }
});
// --- Сцена StableDefusionScene ---
const StableDefusionScene = new Scenes.BaseScene('StableDefusionScene');

StableDefusionScene.enter((ctx) => {
    const limits = getGenerationLimits(); // Получаем лимиты из admin.json
    const usedGenerations = ctx.session.generationCounts?.stableDiffusion || 0; // Использованные генерации
    const remainingGenerations = limits.stableDiffusion - usedGenerations; // Оставшиеся генерации

    const message = `<b>Вы выбрали модель: Stable Diffusion</b>\n` +
        `Введите ваш запрос для генерации изображения.\n` +
        `Чтобы завершить диалог, нажмите кнопку "Завершить диалог".\n\n` +
        `<b>Лимит генераций:</b> ${limits.stableDiffusion}\n` +
        `<b>Осталось генераций:</b> ${remainingGenerations}`;

    ctx.replyWithHTML(
        message,
        Markup.keyboard(['Завершить диалог']).resize().oneTime()
    );
});

StableDefusionScene.on('text', async (ctx) => {
    try {
        if (ctx.message.text === 'Завершить диалог') {
            ctx.scene.enter('modelSelection');
        } else {
            const limits = getGenerationLimits();
            const usedGenerations = ctx.session.generationCounts?.stableDiffusion || 0;

            // Проверяем, не превышен ли лимит
            if (usedGenerations >= limits.stableDiffusion) {
                await ctx.reply('Вы достигли лимита генераций для Stable Diffusion. Пожалуйста, выберите другую модель или попробуйте позже.');
                return;
            }

            // Выполняем генерацию изображения
            const imagePath = await stableDefusion(ctx.message.text, ctx);
            if (!fs.existsSync(imagePath)) {
                throw new Error('Файл изображения не найден.');
            }
            await ctx.replyWithPhoto({ source: fs.createReadStream(imagePath) });

            // Увеличиваем счетчик использованных генераций
            ctx.session.generationCounts = ctx.session.generationCounts || {};
            ctx.session.generationCounts.stableDiffusion = (ctx.session.generationCounts.stableDiffusion || 0) + 1;

            // Сохраняем сессию (если используется telegraf-session-local, это происходит автоматически)
            console.log('Сессия после генерации:', ctx.session);

            // Отправляем обновленное сообщение с оставшимися генерациями
            const remainingGenerations = limits.stableDiffusion - ctx.session.generationCounts.stableDiffusion;
            await ctx.replyWithHTML(`<b>Осталось генераций:</b> ${remainingGenerations}`);
        }
    } catch (error) {
        console.error('Ошибка генерации изображения:', error);
        await ctx.reply('Произошла ошибка при генерации изображения. Пожалуйста, попробуйте позже.');
        ctx.scene.enter('modelSelection'); // Возврат в начальную сцену
    }
});
// --- Сцена Mistralai ---
const MistralaiScene = new Scenes.BaseScene('MistralaiScene');

MistralaiScene.enter((ctx) => {
    const limits = getGenerationLimits(); // Получаем лимиты из admin.json
    const usedGenerations = ctx.session.generationCounts?.mistralai || 0; // Использованные генерации
    const remainingGenerations = limits.mistralai - usedGenerations; // Оставшиеся генерации

    const message = `<b>Вы выбрали модель: MistralAI</b>\n` +
        `Введите ваш запрос.\n` +
        `Чтобы завершить диалог, нажмите кнопку "Завершить диалог".\n\n` +
        `<b>Лимит генераций:</b> ${limits.mistralai}\n` +
        `<b>Осталось генераций:</b> ${remainingGenerations}`;

    ctx.replyWithHTML(
        message,
        Markup.keyboard(['Завершить диалог']).resize().oneTime()
    );
});

MistralaiScene.on('text', async (ctx) => {
    try {
        if (ctx.message.text === 'Завершить диалог') {
            ctx.scene.enter('modelSelection');
        } else {
            const limits = getGenerationLimits();
            const usedGenerations = ctx.session.generationCounts?.mistralai || 0;

            // Проверяем, не превышен ли лимит
            if (usedGenerations >= limits.mistralai) {
                await ctx.reply('Вы достигли лимита генераций для MistralAI. Пожалуйста, выберите другую модель или попробуйте позже.');
                return;
            }

            // Выполняем генерацию
            const response = await mistralAi(ctx.message.text, ctx); // Передаем ctx
            await ctx.replyWithMarkdownV2(response);

            // Увеличиваем счетчик использованных генераций
            ctx.session.generationCounts = ctx.session.generationCounts || {};
            ctx.session.generationCounts.mistralai = (ctx.session.generationCounts.mistralai || 0) + 1;

            // Сохраняем сессию (если используется telegraf-session-local, это происходит автоматически)
            console.log('Сессия после генерации:', ctx.session);

            // Отправляем обновленное сообщение с оставшимися генерациями
            const remainingGenerations = limits.mistralai - ctx.session.generationCounts.mistralai;
            await ctx.replyWithHTML(`<b>Осталось генераций:</b> ${remainingGenerations}`);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        await ctx.reply('Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже.');
        ctx.scene.enter('modelSelection'); // Возврат в начальную сцену
    }
});

// --- Сцена Gemini15FlashScene ---
const Gemini15FlashScene = new Scenes.BaseScene('Gemini15FlashScene');

Gemini15FlashScene.enter((ctx) => {
    const limits = getGenerationLimits(); // Получаем лимиты из admin.json
    const usedGenerations = ctx.session.generationCounts?.gemini || 0; // Использованные генерации
    const remainingGenerations = limits.gemini - usedGenerations; // Оставшиеся генерации

    const message = `<b>Вы выбрали модель: Gemini 1.5 flash</b>\n` +
        `Введите ваш запрос.\n` +
        `Чтобы завершить диалог, нажмите кнопку "Завершить диалог".\n\n` +
        `<b>Лимит генераций:</b> ${limits.gemini}\n` +
        `<b>Осталось генераций:</b> ${remainingGenerations}`;

    ctx.replyWithHTML(
        message,
        Markup.keyboard(['Завершить диалог']).resize().oneTime()
    );
});

Gemini15FlashScene.on('text', async (ctx) => {
    try {
        if (ctx.message.text === 'Завершить диалог') {
            ctx.scene.enter('modelSelection');
        } else {
            const limits = getGenerationLimits();
            const usedGenerations = ctx.session.generationCounts?.gemini || 0;

            // Проверяем, не превышен ли лимит
            if (usedGenerations >= limits.gemini) {
                await ctx.reply('Вы достигли лимита генераций для Gemini 1.5 Flash. Пожалуйста, выберите другую модель или попробуйте позже.');
                return;
            }

            // Выполняем генерацию
            await googleGemeni(ctx.message.text, ctx);

            // Увеличиваем счетчик использованных генераций
            ctx.session.generationCounts = ctx.session.generationCounts || {};
            ctx.session.generationCounts.gemini = (ctx.session.generationCounts.gemini || 0) + 1;

            // Сохраняем сессию (если используется telegraf-session-local, это происходит автоматически)
            console.log('Сессия после генерации:', ctx.session);

            // Отправляем обновленное сообщение с оставшимися генерациями
            const remainingGenerations = limits.gemini - ctx.session.generationCounts.gemini;
            await ctx.replyWithHTML(`<b>Осталось генераций:</b> ${remainingGenerations}`);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        await ctx.reply('Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже.');
        ctx.scene.enter('modelSelection'); // Возврат в начальную сцену
    }
});
// --- Сцена DALL·E ---
const DalleScene = new Scenes.BaseScene('DalleScene');

DalleScene.enter((ctx) => {
    const limits = getGenerationLimits(); // Получаем лимиты из admin.json
    const usedGenerations = ctx.session.generationCounts?.dalle || 0; // Использованные генерации
    const remainingGenerations = limits.dalle - usedGenerations; // Оставшиеся генерации

    const message = `<b>Вы выбрали модель: DALL·E</b>\n` +
        `Введите ваш запрос для генерации изображения.\n` +
        `Чтобы завершить диалог, нажмите кнопку "Завершить диалог".\n\n` +
        `<b>Лимит генераций:</b> ${limits.dalle}\n` +
        `<b>Осталось генераций:</b> ${remainingGenerations}`;

    ctx.replyWithHTML(
        message,
        Markup.keyboard(['Завершить диалог']).resize().oneTime()
    );
});

DalleScene.on('text', async (ctx) => {
    try {
        if (ctx.message.text === 'Завершить диалог') {
            ctx.scene.enter('modelSelection');
        } else {
            const limits = getGenerationLimits();
            const usedGenerations = ctx.session.generationCounts?.dalle || 0;

            // Проверяем, не превышен ли лимит
            if (usedGenerations >= limits.dalle) {
                await ctx.reply('Вы достигли лимита генераций для DALL·E. Пожалуйста, выберите другую модель или попробуйте позже.');
                return;
            }

            // Выполняем генерацию изображения
            const imageUrl = await generateImage(ctx.message.text, ctx.from.id);
            await ctx.replyWithPhoto(imageUrl);

            // Увеличиваем счетчик использованных генераций
            ctx.session.generationCounts = ctx.session.generationCounts || {};
            ctx.session.generationCounts.dalle = (ctx.session.generationCounts.dalle || 0) + 1;

            // Сохраняем сессию (если используется telegraf-session-local, это происходит автоматически)
            console.log('Сессия после генерации:', ctx.session);

            // Отправляем обновленное сообщение с оставшимися генерациями
            const remainingGenerations = limits.dalle - ctx.session.generationCounts.dalle;
            await ctx.replyWithHTML(`<b>Осталось генераций:</b> ${remainingGenerations}`);
        }
    } catch (error) {
        console.error('Ошибка генерации изображения:', error);
        await ctx.reply('Произошла ошибка при генерации изображения. Пожалуйста, попробуйте позже.');
        ctx.scene.enter('modelSelection'); // Возврат в начальную сцену
    }
});
// --- Сцена Claude ---
const ClaudeScene = new Scenes.BaseScene('ClaudeScene');

ClaudeScene.enter((ctx) => {
    const limits = getGenerationLimits();
    const usedGenerations = ctx.session.generationCounts?.claude || 0;
    const remainingGenerations = limits.claude - usedGenerations;
    const message = `<b>Вы выбрали модель: Claude</b>\n` +
        `Введите ваш запрос.\n` +
        `Чтобы завершить диалог, нажмите кнопку "Завершить диалог".\n\n` +
        `<b>Лимит генераций:</b> ${limits.claude}\n` +
        `<b>Осталось генераций:</b> ${remainingGenerations}`;

    ctx.replyWithHTML(
        message,
        Markup.keyboard(['Завершить диалог']).resize().oneTime()
    );
});

ClaudeScene.on('text', async (ctx) => {
    try {
        if (ctx.message.text === 'Завершить диалог') {
            ctx.scene.enter('modelSelection');
        } else {
            const limits = getGenerationLimits();
            const usedGenerations = ctx.session.generationCounts?.claude || 0;

            // Проверяем, не превышен ли лимит
            if (usedGenerations >= limits.claude) {
                await ctx.reply('Вы достигли лимита генераций для Claude. Пожалуйста, выберите другую модель или попробуйте позже.');
                return;
            }

            // Выполняем генерацию
            await claudeModel(ctx, ctx.message.text);

            // Увеличиваем счетчик использованных генераций
            ctx.session.generationCounts = ctx.session.generationCounts || {};
            ctx.session.generationCounts.claude = (ctx.session.generationCounts.claude || 0) + 1;

            // Сохраняем сессию (если используется telegraf-session-local, это происходит автоматически)
            console.log('Сессия после генерации:', ctx.session);

            // Отправляем обновленное сообщение с оставшимися генерациями
            const remainingGenerations = limits.claude - ctx.session.generationCounts.claude;
            await ctx.replyWithHTML(`<b>Осталось генераций:</b> ${remainingGenerations}`);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        await ctx.reply('Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже.');
        ctx.scene.enter('modelSelection'); // Возврат в начальную сцену
    }
});

// --- Админ-панель ---
bot.command('admin', (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        return ctx.reply('У вас нет прав администратора.');
    }

    ctx.reply('Админ-панель', Markup.keyboard([
        ['Включить тех. обслуживание', 'Выключить тех. обслуживание'],
        ['Добавить админа', 'Удалить админа'],
        ['Изменить лимиты генерации'],
    ]).resize());
});

// Включение режима технического обслуживания
bot.hears('Включить тех. обслуживание', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        return ctx.reply('У вас нет прав администратора.');
    }

    toggleMaintenanceMode(true);
    await ctx.reply('Режим технического обслуживания включен.');
    // Завершаем сцену
});

bot.hears('Выключить тех. обслуживание', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        return ctx.reply('У вас нет прав администратора.');
    }

    toggleMaintenanceMode(false);
    await ctx.reply('Режим технического обслуживания выключен.');
    // Завершаем сцену
});

// Добавление администратора
const addAdminScene = new Scenes.BaseScene('addAdminScene');
addAdminScene.enter((ctx) => {
    ctx.reply('Введите ID нового администратора:');
});

addAdminScene.on('text', (ctx) => {
    const newAdminId = parseInt(ctx.message.text);
    if (!isNaN(newAdminId)) {
        addAdmin(newAdminId);
        ctx.reply(`Пользователь с ID ${newAdminId} добавлен в администраторы.`);
        ctx.scene.leave(); // Завершаем сцену
    } else {
        ctx.reply('Некорректный ID. Попробуйте снова.');
    }
});



// Удаление администратора
const removeAdminScene = new Scenes.BaseScene('removeAdminScene');
removeAdminScene.enter((ctx) => {
    ctx.reply('Введите ID администратора для удаления:');
});

removeAdminScene.on('text', (ctx) => {
    const adminId = parseInt(ctx.message.text);
    if (!isNaN(adminId)) {
        removeAdmin(adminId);
        ctx.reply(`Пользователь с ID ${adminId} удален из администраторов.`);
        ctx.scene.leave();
    } else {
        ctx.reply('Некорректный ID. Попробуйте снова.');
    }
});



// Изменение лимитов генерации
const updateLimitScene = new Scenes.BaseScene('updateLimitScene');
updateLimitScene.enter((ctx) => {
    ctx.reply('Выберите модель для изменения лимита:', Markup.inlineKeyboard([
        [Markup.button.callback('ChatGPT', 'set_limit_chatGpt')],
        [Markup.button.callback('Stable Diffusion', 'set_limit_stableDiffusion')],
        [Markup.button.callback('DALL·E', 'set_limit_dalle')],
        [Markup.button.callback('MistralAI', 'set_limit_mistralai')],
        [Markup.button.callback('Claude', 'set_limit_claude')],
        [Markup.button.callback('Gemini', 'set_limit_gemini')],
    ]));
});

updateLimitScene.action(/set_limit_(.+)/, (ctx) => {
    const model = ctx.match[1];
    ctx.session.selectedModel = model; // Сохраняем выбранную модель в сессии
    ctx.reply(`Введите новый лимит генерации для модели ${model}:`);
});

updateLimitScene.on('text', (ctx) => {
    const limit = parseInt(ctx.message.text);
    if (!isNaN(limit) && limit >= 0) {
        const model = ctx.session.selectedModel;
        updateGenerationLimit(model, limit);
        ctx.reply(`Лимит генерации для модели ${model} успешно изменен на ${limit}.`);
        ctx.scene.leave();
    } else {
        ctx.reply('Некорректный лимит. Введите число больше или равное 0.');
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
    ClaudeScene,
    removeAdminScene,
    updateLimitScene,
    addAdminScene,
]);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


// Инициализация сессии
bot.use((ctx, next) => {
    if (!ctx.session) {
        ctx.session = {
            isSubscribed: false,
            generationCounts: {
                chatGpt: 0,
                stableDiffusion: 0,
                dalle: 0,
                mistralai: 0,
                claude: 0,
                gemini: 0,
            },
            selectedModel: null,
        };
        console.log('Сессия инициализирована:', ctx.session);
    } else if (!ctx.session.generationCounts) {
        ctx.session.generationCounts = {
            chatGpt: 0,
            stableDiffusion: 0,
            dalle: 0,
            mistralai: 0,
            claude: 0,
            gemini: 0,
        };
        console.log('Инициализирован generationCounts:', ctx.session.generationCounts);
    }
    return next();
});

bot.use(stage.middleware());
bot.hears('Добавить админа', (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        return ctx.reply('У вас нет прав администратора.');
    }
    ctx.scene.enter('addAdminScene');
});
bot.hears('Удалить админа', (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        return ctx.reply('У вас нет прав администратора.');
    }
    ctx.scene.enter('removeAdminScene');
});
bot.hears('Изменить лимиты генерации', (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        return ctx.reply('У вас нет прав администратора.');
    }
    ctx.scene.enter('updateLimitScene');
});





bot.use(async (ctx, next) => {
    await delay(1000); // Задержка 1 секунда
    await next();
});
// Обработка дубликатов сообщений
const processedMessages = new Map();

setInterval(() => {
    const currentTime = Date.now();
    for (const [key, timestamp] of processedMessages) {
        if (currentTime - timestamp > 120000) {
            processedMessages.delete(key);
        }
    }
}, 120000);

bot.use(async (ctx, next) => {
    // Пропускаем проверку дубликатов для команды /start
    if (ctx.message && ctx.message.text === '/start') {
        return await next();
    }

    // Проверяем, что ctx.message существует
    if (!ctx.message || !ctx.message.message_id) {
        return await next(); // Пропускаем обработку, если это не текстовое сообщение
    }

    const messageId = `${ctx.chat.id}:${ctx.message.message_id}`;
    if (processedMessages.has(messageId)) {
        console.log(`Пропуск повторного сообщения: ${ctx.message.text}`);
        return;
    }

    processedMessages.set(messageId, Date.now());
    await next();
});

// Проверка режима технического обслуживания
bot.use(async (ctx, next) => {
    const maintenanceMode = getMaintenanceMode();
    if (maintenanceMode && !isAdmin(ctx.from.id) && ctx.message.text !== '/start') {
        console.log(`Режим обслуживания включен. Пользователь ${ctx.from.id} заблокирован.`);
        await ctx.reply('Бот находится в режиме технического обслуживания. Пожалуйста, попробуйте позже.');
        return;
    }

    await next();
});
// Команда /reset
bot.command('reset', (ctx) => {
    ctx.session = {
        isSubscribed: false,
        generationCounts: {
            chatGpt: 0,
            stableDiffusion: 0,
            dalle: 0,
            mistralai: 0,
            claude: 0,
            gemini: 0,
        },
        selectedModel: null,
    };
    ctx.scene.leave(); // Выходим из всех сцен
    ctx.reply('Сессия сброшена. Бот перезапущен.');
});

// Команда /start
bot.start(async (ctx) => {
    console.log(`Пользователь ${ctx.from.id} запустил бота.`);

    if (ctx.scene) {
        ctx.scene.leave(); // Выходим из всех активных сцен
    }

    const maintenanceMode = getMaintenanceMode();
    if (maintenanceMode && !isAdmin(ctx.from.id)) {
        console.log(`Режим обслуживания включен. Пользователь ${ctx.from.id} заблокирован.`);
        return ctx.reply('Бот находится в режиме технического обслуживания. Пожалуйста, попробуйте позже.');
    } else if (maintenanceMode && isAdmin(ctx.from.id)) {
        console.log(`Режим обслуживания включен, но пользователь ${ctx.from.id} является администратором.`);
    }

    await ctx.reply('Клавиатура удалена.', Markup.removeKeyboard());
    await greetingMessage(ctx);
    await checkSubscription(ctx);

    if (ctx.session.isSubscribed) {
        console.log(`Пользователь ${ctx.from.id} подписан. Переход в сцену modelSelection.`);
        ctx.scene.enter('modelSelection'); // Переходим в начальную сцену
    } else {
        console.log(`Пользователь ${ctx.from.id} не подписан.`);
    }
});

// Глобальный обработчик ошибок
bot.catch(async (err, ctx) => {
    if (err.response && err.response.error_code === 429) {
        const retryAfter = err.response.parameters.retry_after || 5; // Пауза в секундах
        console.log(`Ошибка 429: Повторная попытка через ${retryAfter} секунд...`);
        await delay(retryAfter * 1000); // Ждем указанное время
        await ctx.reply('Повторная попытка...');
        return;
    }
    console.error('Ошибка в боте:', err);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.');
});

// Запуск бота
bot.launch();

// Graceful stop
process.once('SIGINT', () => {
    console.log('Остановка бота по SIGINT...');
    bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
    console.log('Остановка бота по SIGTERM...');
    bot.stop('SIGTERM');
});
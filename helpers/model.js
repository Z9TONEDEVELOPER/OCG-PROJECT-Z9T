import mongoose from 'mongoose';

// Модель для администраторов
const adminSchema = new mongoose.Schema({
    userId: { type: Number, required: true, unique: true }, // ID администратора
    username: { type: String, required: false }, // Username администратора (опционально)
});

// Модель для настроек (режим техобслуживания, лимиты генерации)
const settingsSchema = new mongoose.Schema({
    maintenanceMode: { type: Boolean, default: false }, // Режим технического обслуживания
    generationLimits: {
        stableDiffusion: { type: Number, default: 5 }, // Лимит генераций Stable Diffusion
        chatGpt: { type: Number, default: 10 }, // Лимит генераций ChatGPT
        dalle: { type: Number, default: 5 }, // Лимит генераций DALL·E
        mistralai: { type: Number, default: 10 }, // Лимит генераций MistralAI
        claude: { type: Number, default: 10 }, // Лимит генераций Claude
    },
});

export const Admin = mongoose.model('Admin', adminSchema);
export const Settings = mongoose.model('Settings', settingsSchema);

// Инициализация начальных настроек
export const initializeSettings = async () => {
    try {
        const settings = await Settings.findOne();
        if (!settings) {
            const defaultSettings = new Settings({
                maintenanceMode: false,
                generationLimits: {
                    stableDiffusion: 5,
                    chatGpt: 10,
                    dalle: 5,
                    mistralai: 10,
                    claude: 10,
                },
            });
            await defaultSettings.save();
            console.log('Начальные настройки созданы.');
        }
    } catch (error) {
        console.error('Ошибка при инициализации настроек:', error);
    }
};

// Добавление администратора
export const addAdmin = async (userId, username) => {
    try {
        const admin = new Admin({ userId, username });
        await admin.save();
        console.log(`Администратор ${userId} добавлен.`);
    } catch (error) {
        if (error.code === 11000) {
            console.error(`Администратор с ID ${userId} уже существует.`);
        } else {
            console.error('Ошибка при добавлении администратора:', error);
        }
    }
};

// Обновление лимита генерации
export const updateGenerationLimit = async (model, limit) => {
    try {
        const settings = await Settings.findOne();
        if (!settings) {
            throw new Error('Настройки не найдены.');
        }
        if (settings.generationLimits[model] === undefined) {
            throw new Error(`Модель ${model} не найдена в generationLimits.`);
        }
        settings.generationLimits[model] = limit;
        await settings.save();
        console.log(`Лимит для модели ${model} обновлен на ${limit}.`);
    } catch (error) {
        console.error('Ошибка при обновлении лимита:', error);
    }
};
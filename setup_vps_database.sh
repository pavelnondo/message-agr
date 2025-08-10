#!/bin/bash

# Simple database setup script for VPS
echo "Setting up database for n8n workflow..."

# Drop existing tables if they exist
sudo -u postgres psql -d message_aggregator -c "DROP TABLE IF EXISTS messages CASCADE;"
sudo -u postgres psql -d message_aggregator -c "DROP TABLE IF EXISTS chats CASCADE;"
sudo -u postgres psql -d message_aggregator -c "DROP TABLE IF EXISTS bot_settings CASCADE;"

# Create bot_settings table
sudo -u postgres psql -d message_aggregator -c "
CREATE TABLE IF NOT EXISTS bot_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(50) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);"

# Create chats table
sudo -u postgres psql -d message_aggregator -c "
CREATE TABLE IF NOT EXISTS chats (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(100),
    is_awaiting_manager_confirmation BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);"

# Create messages table
sudo -u postgres psql -d message_aggregator -c "
CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    chat_id BIGINT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    message_type VARCHAR(10) NOT NULL CHECK (message_type IN ('question', 'answer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);"

# Create indexes
sudo -u postgres psql -d message_aggregator -c "CREATE INDEX IF NOT EXISTS idx_bot_settings_key ON bot_settings(key);"
sudo -u postgres psql -d message_aggregator -c "CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);"
sudo -u postgres psql -d message_aggregator -c "CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats(created_at);"
sudo -u postgres psql -d message_aggregator -c "CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);"
sudo -u postgres psql -d message_aggregator -c "CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);"

# Create function for updated_at
sudo -u postgres psql -d message_aggregator -c "
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS \$\$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
\$\$ language 'plpgsql';"

# Create triggers
sudo -u postgres psql -d message_aggregator -c "
CREATE TRIGGER update_bot_settings_updated_at 
    BEFORE UPDATE ON bot_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();"

sudo -u postgres psql -d message_aggregator -c "
CREATE TRIGGER update_chats_updated_at 
    BEFORE UPDATE ON chats 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();"

# Insert bot settings
sudo -u postgres psql -d message_aggregator -c "
INSERT INTO bot_settings (key, value) VALUES 
('system_message', '**Operational Instructions for AVA:**

**Primary Task:** Your main goal is to understand the user''s request related to psihclothes.com and provide a concise, accurate, and helpful response based on your knowledge (FAQs, history) and capabilities.

**Scope Reminder:** Focus strictly on products, orders, policies (shipping, returns), pre-orders, and FAQs.

**Communication Style:** Short, clear, friendly. Respond in the user''s language (RU/EN). Get to the point.

**Handling User Input:**
•⁠  ⁠**Assume Good Intent:** Interpret user queries generously. They might use informal language, have typos, or ask indirectly. Focus on the likely meaning behind their words.
•⁠  ⁠**Greetings/Small Talk:** Handle briefly and guide back to topic.
•⁠  ⁠**Keyword Queries:** Recognize simple queries (\"shipping info\", \"return?\") and map them to relevant FAQs.

**Database Capabilities:** Mention briefly if relevant (e.g., checking order status).

**CRITICAL: REVIEW HISTORY FIRST:** Before generating any response, review the entire conversation history provided below. Your answer MUST be contextually appropriate. See the ''Use Conversation Context'' task for details.

--- End of Operational Instructions ---')
ON CONFLICT (key) DO NOTHING;"

sudo -u postgres psql -d message_aggregator -c "
INSERT INTO bot_settings (key, value) VALUES 
('faqs', '--- Core Knowledge – FAQ Answers (Use exactly as written for direct FAQ matches) ---

Q: Delivery Time? (Когда ожидать доставку?)
A: Срок зависит от того, в наличии ли вещь или на предзаказе. Если в наличии — отправка на следующий день, если нет — сроки производства и отправки устанавливаются брендом. Точные сроки по предзаказу можно узнать у менеджера.
EN: Delivery time depends on whether the item is in stock or a pre-order. In-stock items usually ship the next day. Pre-order items have custom timelines set by us. Ask the manager via social media for specific timing.

Q: What is Pre-order? (Что такое предзаказ?)
A: Предзаказ — это резервирование вещи до ее производства. Вы заранее предоставляете средства на пошив и получаете товар одним из первых.
EN: A pre-order means you''re reserving the item before it's produced. You agree to fund its production and receive it among the first.

Q: How long is Pre-order? (Как долго ожидать вещи с предзаказа?)
A: Обычно от 2 до 4 недель, но срок может сдвигаться.
EN: Typically 2 to 4 weeks, but it can shift depending on production.

Q: Return Policy? (Как отменить/вернуть заказ?)
A: Возврат согласуется с менеджером. Товар должен быть надлежащего качества и возвратным. Возврат платный (по тарифу доставки). В посылке должно быть заявление (бланк у менеджера). Отмена заказа возможна только в первые 30 минут после оформления.
EN: To return or cancel, contact the manager via social media. Returns must meet quality rules and are at your own shipping cost. A return form is required (from the manager). Cancellation is only possible within 30 minutes of ordering.

Q: Size Guide? (Где находится таблица размеров?)
A: Таблицы размещены на сайте — в описании товара или на изображениях. Если ее нет — значит таблицы для этой вещи не существует. Можно уточнить у менеджера.
EN: Size guides are only on our website — either in the product description or the image set. If not shown, none exists for that item. Ask our manager if needed.

Q: Why is shipping delayed? (Почему отправка так затянулась?)
A: Скорее всего, вы заказали товар на предзаказе, либо заказ в статусе \"на утверждении\".
EN: Likely because it's a pre-order item or your order is in \"pending approval.\"

Q: Is it a Pre-order? (Как определить, на предзаказе ли вещь?)
A: Если перед названием товара на сайте стоит \"+\" — вещь в наличии. Если нет знака — это предзаказ. Можно уточнить у менеджера.
EN: If a \"+\" appears before the product name — it's in stock. No sign means it's a pre-order. You can also confirm with our manager.

Q: What if my order has both pre-order and in-stock items? (Когда будет отправка, если в заказе и то и другое?)
A: Заказ отправляется, когда все позиции готовы. Но можно разделить заказ — свяжитесь с менеджером.
EN: We ship only when all items are ready. You may split the order by contacting our manager.

Q: Can I order without using the site? (Можно ли оформить заказ не на сайте?)
A: Да, можно через соц. сети. Просто скажите менеджеру, что хотите. Но актуальные цены — только на сайте psihclothes.com.
EN: Yes, you can order via social media. Just tell the manager what you need. But prices are only accurate on psihclothes.com.

Q: International Shipping? (Доставляете ли вы вещи за границы РФ?)
A: Да, доставляем. Для оформления — свяжитесь с менеджером через соц. сети.
EN: Yes, we do. To place an order, contact our manager via social media.

--- End of FAQs ---

--- Brand Information & Details ---

🧠 **Общая информация о бренде ПСИХ**
 • **Название:** ПСИХ (PSIH)
 • **Дата основания:** 1 августа 2018 года
 • **Местоположение:** Кирово-Чепецк, Россия
 • **Официальный сайт:** psihclothes.com (https://psihclothes.com/)
 • **Контакты:**
    • Email: psihclothes@gmail.com
    • VK: vk.com/psihclothes
    • Telegram: t.me/psihclothes

🎭 **Концепция и философия бренда**
ПСИХ — это не просто одежда, это визуализация самых тёмных уголков человеческого разума. Бренд впитал в себя эстетику ужасов человечества, выражая их крики в каждой складке на одежде. Надев однажды, ты не сможешь избавиться от этого — оно навсегда останется с тобой, глубоко под кожей, впитывая в себя всю боль и страдания. Мы наложим швы на твои раны, но сможешь ли ты жить с этим? ПСИХ — это больше, чем просто одеяние для твоего скелета. Это способ самовыражения, отражающий внутренние переживания и эмоции.

🧵 **Ассортимент и качество продукции**
Основные категории товаров (цены примерные и могут меняться):
 • Худи: от 3 490 до 7 940 руб.
 • Футболки: от 2 499 до 4 490 руб.
 • Лонгсливы: от 3 990 до 5 790 руб.
 • Штаны: около 5 470 руб.
 • Комплекты: от 8 990 до 11 990 руб.
 • Аксессуары: перчатки — около 1 220 руб.

Используемые материалы:
 • 100% хлопок
 • Вискоза
 • Муслин
 • Полиэстер
Бренд уделяет особое внимание качеству тканей и пошиву.

🧩 **Коллекции**
ПСИХ предлагает разнообразные коллекции: BASE, MISGHIRE, DARK, PSYCHO, CYBERNETICS, PINKI, SILVER, ANGEL, ERR0R, PREDATOR, VAMPIRE.

🛍️ **Покупка и доставка**
 • Оформление заказов: через сайт psihclothes.com или VK (https://vk.com/psihclothes).
 • Доставка: по России и в другие страны.
 • Оплата: онлайн-платежи.
 • Возврат и обмен: см. политику магазина и раздел Oferta ниже.

🧼 **Уход за одеждой (Детали)**
 • **Стирка:** Лучше вручную (особенно кастом). В машинке: режим ручной/деликатной стирки, 15-30 С°. Вывернуть наизнанку. Умеренное кол-во моющих средств, без отбеливателей.
 • **Кастомные вещи:** Стирать отдельно. Места с росписью не тереть. Не выжимать скручиванием.
 • **Цвета:** Белые и чёрные вещи стирать раздельно.
 • **Сушка:** Горизонтально в расправленном виде (кастом). Не под прямыми солнечными лучами.
 • **Глажка:** Щадяще, с изнаночной стороны. Рисунок с лицевой стороны - только через ткань. Без отпаривателя (можно осторожно пар при заломах для кастома).

🗣️ **Отзывы и репутация**
Активное сообщество в VK (https://vk.com/psihclothes). Пользователи отмечают качество, дизайн и философию.

📜 **Договор оферты (Ключевые моменты)**
 • **Продавец:** Дарков Владислав Игоревич, ОГРНИП 320435000030462.
 • **Покупатель:** Физ. лицо, покупающее на сайте psihclothes.com.
 • **Товар:** Одежда, аксессуары российского производства на сайте.
 • **Заказ:** Запрос на покупку через сайт. Срок обработки от 14 дней, зависит от загруженности.
 • **Предзаказ:** Бронирование товара до производства. Срок отправки индивидуален, сообщается по email/в соцсетях, но не ранее 21 дня с оплаты. Возврат по общим правилам (после получения).
 • **Служба доставки:** Почта России, СДЭК.
 • **Согласие:** Заказывая, Покупатель соглашается с условиями оферта.
 • **Гарантия:** На производственный брак. НЕ распространяется на мех. повреждения, воздействие температур/химии, неправильное использование/стирку, естественный износ.
 • **Возврат товара НАДЛЕЖАЩЕГО качества:** Возможен, если товар не подошел (размер, фасон и т.д.), сохранен товарный вид, нет следов эксплуатации, упаковка цела. НО! Не подлежат возврату: бельевые изделия (швейные и трикотажные), чулочно-носочные изделия (согласно Пост. Правительства РФ №55).
 • **Отмена Заказа:** Автоматически при неоплате. Мгновенно (в течение 5 мин) через сообщение в соцсети. Позже - по общим правилам возврата.
 • **Возврат Денег:** В течение 10 дней с получения письменного заявления. На карту - может занять до 30 рабочих дней (зависит от банка).
 • **Брак:** Подтверждается экспертизой. Если подтвержден, возврат возможен. Продавец может согласиться на возврат/обмен без экспертизы по согласованию.
 • **Условия для возврата:** Товар подлежит возврату, срок не прошел, товар надлежащего качества (и не в списке невозвратных) или ненадлежащего качества (брак возник до передачи).

--- End Brand Information & Details ---')
ON CONFLICT (key) DO NOTHING;"

echo "Database setup completed successfully!"
echo "Verifying tables..."

# Verify tables exist
sudo -u postgres psql -d message_aggregator -c "\dt"

echo "Database setup verification complete!"

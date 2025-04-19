// Элемент для сохранения полученных данных
let parsedData = null;

/*
// Обработчик клика по заглушке "Сохранить промпт"
document.getElementById('savePromptBtn').addEventListener('click', () => {
  // Пока просто выводим значение в консоль (будущая логика сохранения промпта)
  const promptText = document.getElementById('promptInput').value;
  console.log('Промпт сохранён:', promptText);
}); */

// Обработчик клика по кнопке "Спарсить отзывы о товаре"
document.getElementById('parseBtn').addEventListener('click', async () => {
  // Получаем активную вкладку
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) {
    alert("Не удалось получить URL активной вкладки");
    return;
  }
  
  const currentUrl = new URL(tab.url);
  console.log("Текущий домен:", currentUrl.hostname);

  // Получаем значение чекбокса – нужно ли парсить отзыв продавца (для Wildberries)
  const parseSellerAnswerOption = document.getElementById('parseSellerAnswerChk').checked;

  // Определяем, какая функция парсинга будет вызвана в зависимости от домена
  let parseFunc = null;
  if (currentUrl.hostname.indexOf("ozon.ru") !== -1) {
    // Функция parseOzonPage принимает опциональный параметр, но sellerAnswer не используется
    parseFunc = parseOzonPage;
  } else if (currentUrl.hostname.indexOf("wildberries.ru") !== -1) {
    parseFunc = parseWildberriesPage;
  } else {
    alert("Парсинг поддерживается только для ozon.ru и wildberries.ru");
    return;
  }
  
  // Запускаем функцию парсинга на странице через chrome.scripting.executeScript
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: parseFunc,
      // Передаём объект параметров – если чекбокс установлен, параметр parseSellerAnswer будет true
      args: [{ parseSellerAnswer: parseSellerAnswerOption }]
    });
    
    console.log("Полученные данные:", result);
    parsedData = result; // сохраняем данные в переменную
    // Отображаем кнопку для скачивания JSON
    document.getElementById('downloadContainer').style.display = 'block';
    
  } catch (error) {
    console.error("Ошибка при выполнении скрипта парсинга:", error);
    alert("Ошибка при парсинге страницы");
  }
});

// Обработчик клика по кнопке "Скачать json файл"
document.getElementById('downloadBtn').addEventListener('click', () => {
  if (!parsedData) return;
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(parsedData, null, 2));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);

  // Формирование имени файла: артикул_датаВремя_первые50символовНазвание.json
  const sku = parsedData.sku || "unknownSKU";
  const productName = parsedData.productName || "product";
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, "-"); // заменяем двоеточия и точки
  const namePart = productName.slice(0, 50).replace(/\s+/g, '_');
  const fileName = `${sku}_${dateStr}_${namePart}.json`;

  downloadAnchorNode.setAttribute("download", fileName);
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
});

function parseWildberriesPage(options = {}) {
  // Извлечение названия товара
  let productName = null;
  const nameEl = document.querySelector('a.product-line__name.hide-mobile');
  if (nameEl) {
    const bEl = nameEl.querySelector('b');
    productName = bEl ? bEl.textContent.trim() : nameEl.textContent.trim();
  }

  // Извлечение артикула (SKU)
  let sku = null;
  const skuEl = document.querySelector('a.product-line__img.img-plug');
  if (skuEl && skuEl.href) {
    const match = skuEl.href.match(/catalog\/(\d+)\//);
    if (match) {
      sku = match[1];
    }
  }
  // Если не найдено, пробуем извлечь из текущего URL
  if (!sku) {
    const urlMatch = window.location.href.match(/catalog\/(\d+)/);
    if (urlMatch) {
      sku = urlMatch[1];
    }
  }

  // Категории для Wildberries не парсятся – устанавливаем null
  let categories = null;

  // Извлечение цены (черная цена, без оформления "red-price")
  let price = null;
  const priceEl = document.querySelector('b.product-line__price-now.wallet');
  if (priceEl) {
    price = priceEl.textContent.trim();
  }

  // Извлечение общего рейтинга товара
  let rating = null;
  const ratingEl = document.querySelector('.rating-product__numb');
  if (ratingEl) {
    rating = ratingEl.textContent.trim();
  }

  // Извлечение отзывов
  let reviews = [];
  const reviewElements = document.querySelectorAll('li.comments__item.feedback');
  reviewElements.forEach(reviewEl => {
    // Извлекаем дату отзыва
    const dateEl = reviewEl.querySelector('.feedback__date');
    const date = dateEl ? dateEl.textContent.trim() : null;

    // Извлечение текста отзыва с разбиением на части
    let reviewText = null;
    const reviewContent = reviewEl.querySelector('p.feedback__text.j-feedback__text.show');
    if (reviewContent) {
      let advantages = "", disadvantages = "", comment = "";
      // Ищем все части отзыва (элементы с классом feedback__text--item)
      const items = reviewContent.querySelectorAll('span.feedback__text--item');
      if (items.length > 0) {
        items.forEach(item => {
          const boldEl = item.querySelector('span.feedback__text--item-bold');
          if (boldEl) {
            const label = boldEl.textContent.trim().toLowerCase();
            // Удаляем ярлык из текста, чтобы оставить только содержимое
            const textWithoutLabel = item.textContent.replace(boldEl.textContent, '').trim();
            if (label.includes("достоинств")) {
              advantages = textWithoutLabel;
            } else if (label.includes("недостатки")) {
              disadvantages = textWithoutLabel;
            } else if (label.includes("комментарий")) {
              comment = textWithoutLabel;
            }
          } else {
            // Если ярлыка нет – добавляем как часть комментария
            comment += (comment ? " " : "") + item.textContent.trim();
          }
        });
        reviewText = { advantages, disadvantages, comment };
      } else {
        // Если разделённых элементов нет, берем весь текст
        reviewText = reviewContent.textContent.trim();
      }
    } else {
      reviewText = reviewEl.querySelector('p.feedback__text')?.textContent.trim() || null;
    }

    // Извлечение ответа продавца (если присутствует)
    let sellerAnswer = null;
    if (options.parseSellerAnswer) {
      const answerContainer = reviewEl.querySelector('div.feedback__sellers-reply');
      if (answerContainer) {
        const answerEl = answerContainer.querySelector('p.feedback__text');
        sellerAnswer = answerEl ? answerEl.textContent.trim() : null;
      }
    }

    // Добавляем отзыв в массив
    reviews.push({
      date: date,
      text: reviewText,
      rating: null, // Можно реализовать логику подсчёта оценки, если потребуется
      answer: sellerAnswer
    });
  });

  // Собираем все данные в один объект
  const parsed = {
    productName: productName,
    sku: sku,
    categories: categories,
    price: price,
    rating: rating,
    reviews: reviews
  };

  // Возвращаем полученный объект, он попадёт в результат executeScript
  return parsed;
}

/**
 * Функция, выполняемая непосредственно на странице ozon.ru.
 * Собирает необходимые данные:
 *  - Имя товара
 *  - Артикул (SKU)
 *  - Категории (из хлебных крошек)
 *  - Цена (без Ozon Карты)
 *  - Оценка товара
 *  - Отзывы (с датой, текстом и оценкой)
 *
 * В дальнейшем эту функцию можно расширять для поддержки других магазинов.
 */
function parseOzonPage(options = {}) {
  // Вспомогательная функция для безопасного получения текста элемента
  function getText(selector) {
    const el = document.querySelector(selector);
    return el ? el.textContent.trim() : null;
  }
  
  // Собираем категории из хлебных крошек
  let categories = [];
  try {
    // Ищем контейнер хлебных крошек по data-widget
    const breadcrumbsContainer = document.querySelector('div[data-widget="breadCrumbs"] ol');
    if (breadcrumbsContainer) {
      // Для каждого элемента li ищем текст в span (или внутри ссылки)
      const liElements = breadcrumbsContainer.querySelectorAll('li');
      liElements.forEach(li => {
        let text = "";
        // Если внутри есть <a> – берем его текст, иначе ищем <span>
        const aEl = li.querySelector('a');
        if (aEl) {
          text = aEl.textContent.trim();
        } else {
          const spanEl = li.querySelector('span');
          if (spanEl) {
            text = spanEl.textContent.trim();
          }
        }
        if (text) {
          categories.push(text);
        }
      });
    }
  } catch (e) {
    console.error("Ошибка парсинга хлебных крошек:", e);
  }
  
  // Парсинг имени товара
  const productName = (function() {
    const el = document.querySelector('[data-widget="webProductHeading"] h1');
    return el ? el.textContent.trim() : null;
  })();

  // Парсинг рейтинга товара.
  // Здесь ищем элемент с оценкой внутри ссылки, содержащей отзывы
  let rating = null;
  try {
    const ratingEl = document.querySelector('div[data-widget="webSingleProductScore"] a .ga121-a2');
    if (ratingEl) {
      // В тексте может быть, например, "4.8 • 139 отзывов". Разобьём по разделителю
      rating = ratingEl.textContent.trim().split('•')[0].trim();
    }
  } catch (e) {
    console.error("Ошибка парсинга рейтинга товара:", e);
  }
  
  // Парсинг артикула (SKU)
  let sku = null;
  try {
    // Ищем кнопку с data-widget="webDetailSKU" и извлекаем текст
    const skuEl = document.querySelector('button[data-widget="webDetailSKU"] .ga121-a2');
    if (skuEl) {
      const skuText = skuEl.textContent.trim();
      // Ожидаем формат "Артикул: 1576304369" – извлекаем число
      const match = skuText.match(/Артикул:\s*(\d+)/);
      if (match) {
        sku = match[1];
      }
    }
  } catch (e) {
    console.error("Ошибка парсинга артикула:", e);
  }
  
  // Парсинг цены (без Ozon Карты)
  let price = null;
  try {
    const priceSpans = document.querySelectorAll('[data-widget="webPrice"] span');
    priceSpans.forEach(span => {
      if (span.parentElement && span.parentElement.textContent.indexOf("без Ozon Карты") !== -1) {
        price = span.textContent.trim();
      }
    });
    if (!price && priceSpans.length > 0) {
      price = priceSpans[0].textContent.trim();
    }
  } catch (e) {
    console.error("Ошибка парсинга цены:", e);
  }
  
  // Парсинг отзывов
  let reviews = [];
  try {
    // На странице отзывы находятся в элементах с классом "qw2_30" (контейнер для каждого отзыва)
    const reviewContainers = document.querySelectorAll('div.qw2_30 > div[data-review-uuid]');
    reviewContainers.forEach(reviewEl => {
      // Дата отзыва – ищем элемент с классом, например, "p1r_30" или внутри "pr1_30"
      const date = reviewEl.querySelector('.pr1_30 .p1r_30') ?
                   reviewEl.querySelector('.pr1_30 .p1r_30').textContent.trim() :
                   reviewEl.querySelector('.pr1_30')?.textContent.trim();
      
      // Обновлённое извлечение текста отзыва
      let reviewText = null;
      const partsContainer = reviewEl.querySelector('div.rp2_30');

      if (partsContainer) {
        // Проверяем, есть ли в контейнере хотя бы один элемент с явной меткой (например, "Достоинства")
        const labeledParts = partsContainer.querySelectorAll('div.pr3_30');
        if (labeledParts.length > 0) {
          let advantages = '', disadvantages = '', comment = '';
          const partElements = partsContainer.querySelectorAll('div.p3r_30');
          partElements.forEach(part => {
            const labelEl = part.querySelector('div.pr3_30');
            const textEl = part.querySelector('span.r2p_30');
            const label = labelEl ? labelEl.textContent.trim().toLowerCase() : "";
            const text = textEl ? textEl.textContent.trim() : "";
            
            if (label.indexOf("достоинств") !== -1) {
              advantages = text;
            } else if (label.indexOf("недостатк") !== -1) {
              disadvantages = text;
            } else if (label.indexOf("комментар") !== -1) {
              comment = text;
            }
          });
          reviewText = { advantages, disadvantages, comment };
        } else {
          // Если явных меток нет, предполагаем, что это простой отзыв
          reviewText = partsContainer.querySelector('span.r2p_30')?.textContent.trim() || null;
        }
      } else {
        // Если блока с разделением не найдено, берём первый найденный span с текстом отзыва
        reviewText = reviewEl.querySelector('span.r2p_30')?.textContent.trim() || null;
      }

      const text = reviewText;

      // Оценка отзыва – можно посчитать количество svg-иконок (звёзд) внутри соответствующего контейнера
      let reviewRating = 0;
      const ratingContainer = reviewEl.querySelector('.a5d24-a');
      if (ratingContainer) {
        const svgElements = ratingContainer.querySelectorAll('svg');
        svgElements.forEach(svg => {
          const style = svg.getAttribute('style') || "";
          if (style.indexOf("rgb(255, 168, 0)") !== -1) {
            reviewRating++;
          }
        });
      }
      
      // Если отзыв содержит текст – добавляем его в список
      if (text && date) {
        reviews.push({
          date: date,
          text: text,
          rating: reviewRating
        });
      }
    });
  } catch (e) {
    console.error("Ошибка парсинга отзывов:", e);
  }
  
  // Собираем все данные в один объект
  const parsed = {
    productName: productName,
    sku: sku,
    categories: categories,
    price: price,
    rating: rating,
    reviews: reviews
  };
  
  // Возвращаем полученный объект, он попадёт в результат executeScript
  return parsed;
}

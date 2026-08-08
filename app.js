// ========================================
// MOMO
// CLEAN FOUNDATION + FUNCTIONAL TRIPS
// ========================================


// ========================================
// DATABASE
// ========================================

const DB_NAME = "momo_database";

const DB_VERSION = 3;


const STORES = {

  expenses: "expenses",

  budgets: "budgets",

  trips: "trips",

  cards: "cards",


  recurring: "recurring",

  planned: "planned",

  settings: "settings"

};


let db = null;


// ========================================
// STATE
// ========================================

let expenses = [];

let budgets = [];

let trips = [];

let cards = [];


let recurringExpenses = [];


let plannedExpenses = [];


let plannedPendingDelete =
  null;


let pendingPlannedConversionId =
  "";


let activeBudgetFilter =
  "all";


let budgetPendingDelete =
  null;


let tripPendingDelete =
  null;


let expensePendingDelete =
  null;


let recurringPendingDelete =
  null;


let pendingBackupRestore =
  null;


let selectedExpenseDetailId =
  "";


let editingExpenseId =
  "";


let openingExpenseEditor =
  false;


let currentPhotoData =
  "";


let photoProcessingPromise =
  null;


const PHOTO_MAX_DIMENSION =
  1600;


const PHOTO_JPEG_QUALITY =
  0.8;


// ========================================
// CURRENCY
// ========================================

const EXCHANGE_RATES = {

  PHP: 1,

  JPY: 2.56,

  USD: 0.0175,

  GBP: 0.0132,

  HKD: 0.136,

  SGD: 0.0224,

  CNY: 0.125

};


const CURRENCY_INFO = {

  PHP: {
    symbol: "₱"
  },

  JPY: {
    symbol: "¥"
  },

  USD: {
    symbol: "$"
  },

  GBP: {
    symbol: "£"
  },

  HKD: {
    symbol: "HK$"
  },

  SGD: {
    symbol: "S$"
  },

  CNY: {
    symbol: "¥"
  }

};


const LOCAL_KEYS = {

  converterA:
    "momo_converter_currency_a",

  converterB:
    "momo_converter_currency_b",

  cleanStart:
    "momo_clean_start_v1"

};


let converterEditingSide =
  "A";


let converterIsUpdating =
  false;


// ========================================
// OPEN DATABASE
// ========================================

function openDatabase() {

  return new Promise(
    (resolve, reject) => {

      const request =
        indexedDB.open(
          DB_NAME,
          DB_VERSION
        );


      request.onupgradeneeded =
        (event) => {

          const database =
            event.target.result;


          // EXPENSES

          if (
            !database.objectStoreNames.contains(
              STORES.expenses
            )
          ) {

            const store =
              database.createObjectStore(
                STORES.expenses,
                {
                  keyPath: "id"
                }
              );


            store.createIndex(
              "date",
              "date",
              {
                unique: false
              }
            );


            store.createIndex(
              "category",
              "category",
              {
                unique: false
              }
            );


            store.createIndex(
              "budgetId",
              "budgetId",
              {
                unique: false
              }
            );


            store.createIndex(
              "tripId",
              "tripId",
              {
                unique: false
              }
            );

          }


          // BUDGETS

          if (
            !database.objectStoreNames.contains(
              STORES.budgets
            )
          ) {

            const store =
              database.createObjectStore(
                STORES.budgets,
                {
                  keyPath: "id"
                }
              );


            store.createIndex(
              "period",
              "period",
              {
                unique: false
              }
            );


            store.createIndex(
              "category",
              "category",
              {
                unique: false
              }
            );

          }


          // TRIPS

          if (
            !database.objectStoreNames.contains(
              STORES.trips
            )
          ) {

            const store =
              database.createObjectStore(
                STORES.trips,
                {
                  keyPath: "id"
                }
              );


            store.createIndex(
              "startDate",
              "startDate",
              {
                unique: false
              }
            );


            store.createIndex(
              "endDate",
              "endDate",
              {
                unique: false
              }
            );

          }


          // CARDS

          if (
            !database.objectStoreNames.contains(
              STORES.cards
            )
          ) {

            database.createObjectStore(
              STORES.cards,
              {
                keyPath: "id"
              }
            );

          }


          // REMOVE LEGACY ACCOUNTS STORE

          if (
            database.objectStoreNames.contains(
              "accounts"
            )
          ) {

            database.deleteObjectStore(
              "accounts"
            );

          }


          // RECURRING

          if (
            !database.objectStoreNames.contains(
              STORES.recurring
            )
          ) {

            database.createObjectStore(
              STORES.recurring,
              {
                keyPath: "id"
              }
            );

          }


          // PLANNED EXPENSES

          if (
            !database.objectStoreNames.contains(
              STORES.planned
            )
          ) {

            const store =
              database.createObjectStore(
                STORES.planned,
                {
                  keyPath: "id"
                }
              );


            store.createIndex(
              "targetDate",
              "targetDate",
              {
                unique: false
              }
            );


            store.createIndex(
              "tripId",
              "tripId",
              {
                unique: false
              }
            );


            store.createIndex(
              "status",
              "status",
              {
                unique: false
              }
            );

          }


          // SETTINGS

          if (
            !database.objectStoreNames.contains(
              STORES.settings
            )
          ) {

            database.createObjectStore(
              STORES.settings,
              {
                keyPath: "key"
              }
            );

          }

        };


      request.onsuccess =
        () => {

          db =
            request.result;


          db.onversionchange =
            () => {

              db.close();

            };


          resolve(db);

        };


      request.onerror =
        () => {

          reject(
            request.error
          );

        };

    }
  );

}


// ========================================
// INDEXEDDB HELPERS
// ========================================

function getAllRecords(
  storeName
) {

  return new Promise(
    (resolve, reject) => {

      const transaction =
        db.transaction(
          storeName,
          "readonly"
        );


      const store =
        transaction.objectStore(
          storeName
        );


      const request =
        store.getAll();


      request.onsuccess =
        () => {

          resolve(
            request.result || []
          );

        };


      request.onerror =
        () => {

          reject(
            request.error
          );

        };

    }
  );

}


function putRecord(
  storeName,
  record
) {

  return new Promise(
    (resolve, reject) => {

      const transaction =
        db.transaction(
          storeName,
          "readwrite"
        );


      const store =
        transaction.objectStore(
          storeName
        );


      const request =
        store.put(
          record
        );


      request.onsuccess =
        () => {

          resolve(
            record
          );

        };


      request.onerror =
        () => {

          reject(
            request.error
          );

        };

    }
  );

}


function deleteRecord(
  storeName,
  id
) {

  return new Promise(
    (resolve, reject) => {

      const transaction =
        db.transaction(
          storeName,
          "readwrite"
        );


      const store =
        transaction.objectStore(
          storeName
        );


      const request =
        store.delete(
          id
        );


      request.onsuccess =
        () => {

          resolve();

        };


      request.onerror =
        () => {

          reject(
            request.error
          );

        };

    }
  );

}


function clearStore(
  storeName
) {

  return new Promise(
    (resolve, reject) => {

      const transaction =
        db.transaction(
          storeName,
          "readwrite"
        );


      const store =
        transaction.objectStore(
          storeName
        );


      const request =
        store.clear();


      request.onsuccess =
        () => {

          resolve();

        };


      request.onerror =
        () => {

          reject(
            request.error
          );

        };

    }
  );

}


// ========================================
// CLEAN OLD DEMO DATA ONCE
// ========================================

async function performCleanStartIfNeeded() {

  const alreadyCleaned =
    localStorage.getItem(
      LOCAL_KEYS.cleanStart
    );


  if (
    alreadyCleaned ===
    "yes"
  ) {

    return;

  }


  localStorage.removeItem(
    "momo_budgets"
  );


  localStorage.removeItem(
    "momo_expenses"
  );


  await Promise.all([

    clearStore(
      STORES.expenses
    ),

    clearStore(
      STORES.budgets
    ),

    clearStore(
      STORES.trips
    ),

    clearStore(
      STORES.cards
    ),

    clearStore(
      STORES.recurring
    ),

    clearStore(
      STORES.planned
    )

  ]);


  localStorage.setItem(
    LOCAL_KEYS.cleanStart,
    "yes"
  );

}


// ========================================
// LOAD ALL DATA
// ========================================

async function loadAppData() {

  [

    expenses,

    budgets,

    trips,

    cards,

    recurringExpenses,

    plannedExpenses

  ] = await Promise.all([

    getAllRecords(
      STORES.expenses
    ),

    getAllRecords(
      STORES.budgets
    ),

    getAllRecords(
      STORES.trips
    ),

    getAllRecords(
      STORES.cards
    ),

    getAllRecords(
      STORES.recurring
    ),

    getAllRecords(
      STORES.planned
    )

  ]);


  expenses.sort(
    (
      a,
      b
    ) => {

      const dateA =
        new Date(
          a.createdAt ||
          a.date ||
          0
        );


      const dateB =
        new Date(
          b.createdAt ||
          b.date ||
          0
        );


      return (
        dateB -
        dateA
      );

    }
  );


  trips.sort(
    (
      a,
      b
    ) => {

      return (
        new Date(
          a.startDate
        ) -
        new Date(
          b.startDate
        )
      );

    }
  );


  plannedExpenses.sort(
    (
      a,
      b
    ) => {

      const dateA =
        a.targetDate ||
        "9999-12-31";


      const dateB =
        b.targetDate ||
        "9999-12-31";


      return (
        dateA.localeCompare(
          dateB
        ) ||
        String(
          a.createdAt ||
          ""
        ).localeCompare(
          String(
            b.createdAt ||
            ""
          )
        )
      );

    }
  );

}


// ========================================
// GENERAL HELPERS
// ========================================

function generateId(
  prefix = "item"
) {

  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

}


function escapeHTML(
  value = ""
) {

  return String(value)

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    );

}


function getTodayString() {

  const today =
    new Date();


  const year =
    today.getFullYear();


  const month =
    String(
      today.getMonth() + 1
    ).padStart(
      2,
      "0"
    );


  const day =
    String(
      today.getDate()
    ).padStart(
      2,
      "0"
    );


  return `${year}-${month}-${day}`;

}


function createLocalDate(
  dateString
) {

  if (
    !dateString
  ) {

    return null;

  }


  return new Date(
    `${dateString}T00:00:00`
  );

}


function formatDate(
  dateString
) {

  if (
    !dateString
  ) {

    return "";

  }


  const date =
    createLocalDate(
      dateString
    );


  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric"
    }
  ).format(
    date
  );

}


function formatShortDate(
  dateString
) {

  if (
    !dateString
  ) {

    return "";

  }


  const date =
    createLocalDate(
      dateString
    );


  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric"
    }
  ).format(
    date
  );

}


// ========================================
// SAFE CALCULATOR
// ========================================

function calculateExpression(
  expression
) {

  if (
    expression === null ||
    expression === undefined
  ) {

    return null;

  }


  let text =
    String(
      expression
    )

      .replaceAll(
        ",",
        ""
      )

      .replaceAll(
        "×",
        "*"
      )

      .replaceAll(
        "÷",
        "/"
      )

      .replace(
        /\s+/g,
        ""
      );


  if (
    !text
  ) {

    return null;

  }


  if (
    !/^[0-9+\-*/().]+$/.test(
      text
    )
  ) {

    return null;

  }


  let position = 0;


  function peek() {

    return text[
      position
    ];

  }


  function consume() {

    return text[
      position++
    ];

  }


  function parseNumber() {

    let numberText =
      "";


    let decimalCount =
      0;


    while (
      position <
      text.length
    ) {

      const character =
        peek();


      if (
        character >=
          "0" &&
        character <=
          "9"
      ) {

        numberText +=
          consume();

        continue;

      }


      if (
        character ===
        "."
      ) {

        decimalCount++;


        if (
          decimalCount >
          1
        ) {

          throw new Error(
            "Invalid number"
          );

        }


        numberText +=
          consume();

        continue;

      }


      break;

    }


    if (
      numberText ===
        "" ||
      numberText ===
        "."
    ) {

      throw new Error(
        "Expected number"
      );

    }


    return Number(
      numberText
    );

  }


  function parseFactor() {

    const current =
      peek();


    if (
      current ===
      "+"
    ) {

      consume();

      return parseFactor();

    }


    if (
      current ===
      "-"
    ) {

      consume();

      return -parseFactor();

    }


    if (
      current ===
      "("
    ) {

      consume();


      const value =
        parseExpression();


      if (
        peek() !==
        ")"
      ) {

        throw new Error(
          "Missing parenthesis"
        );

      }


      consume();


      return value;

    }


    return parseNumber();

  }


  function parseTerm() {

    let value =
      parseFactor();


    while (
      position <
      text.length
    ) {

      const operator =
        peek();


      if (
        operator !==
          "*" &&
        operator !==
          "/"
      ) {

        break;

      }


      consume();


      const right =
        parseFactor();


      if (
        operator ===
        "*"
      ) {

        value *=
          right;

      } else {

        if (
          right ===
          0
        ) {

          throw new Error(
            "Division by zero"
          );

        }


        value /=
          right;

      }

    }


    return value;

  }


  function parseExpression() {

    let value =
      parseTerm();


    while (
      position <
      text.length
    ) {

      const operator =
        peek();


      if (
        operator !==
          "+" &&
        operator !==
          "-"
      ) {

        break;

      }


      consume();


      const right =
        parseTerm();


      if (
        operator ===
        "+"
      ) {

        value +=
          right;

      } else {

        value -=
          right;

      }

    }


    return value;

  }


  try {

    const result =
      parseExpression();


    if (
      position !==
      text.length
    ) {

      return null;

    }


    if (
      !Number.isFinite(
        result
      )
    ) {

      return null;

    }


    return result;

  } catch {

    return null;

  }

}


// ========================================
// CURRENCY HELPERS
// ========================================

function convertCurrency(
  amount,
  fromCurrency,
  toCurrency
) {

  const numericAmount =
    Number(
      amount ||
      0
    );


  if (
    fromCurrency ===
    toCurrency
  ) {

    return numericAmount;

  }


  const fromRate =
    EXCHANGE_RATES[
      fromCurrency
    ];


  const toRate =
    EXCHANGE_RATES[
      toCurrency
    ];


  if (
    !fromRate ||
    !toRate
  ) {

    return 0;

  }


  const amountInPHP =
    numericAmount /
    fromRate;


  return (
    amountInPHP *
    toRate
  );

}


function formatCurrency(
  value,
  currency =
    "PHP"
) {

  const amount =
    Number(
      value ||
      0
    );


  return new Intl.NumberFormat(
    "en-US",
    {
      style:
        "currency",

      currency,

      minimumFractionDigits:
        currency ===
        "JPY"

          ? 0

          : 2,

      maximumFractionDigits:
        currency ===
        "JPY"

          ? 0

          : 2
    }
  ).format(
    amount
  );

}


function formatPHP(
  value
) {

  return formatCurrency(
    value,
    "PHP"
  );

}


function formatPlainNumber(
  value,
  currency
) {

  return Number(
    value
  ).toLocaleString(
    "en-US",
    {
      maximumFractionDigits:
        currency ===
        "JPY"

          ? 0

          : 2
    }
  );

}


// ========================================
// DRAWER
// ========================================

const menuButton =
  document.getElementById(
    "menuButton"
  );


const sideDrawer =
  document.getElementById(
    "sideDrawer"
  );


const drawerOverlay =
  document.getElementById(
    "drawerOverlay"
  );


const closeDrawerButton =
  document.getElementById(
    "closeDrawer"
  );


function openDrawer() {

  sideDrawer?.classList.add(
    "open"
  );


  if (
    drawerOverlay
  ) {

    drawerOverlay.hidden =
      false;

  }


  sideDrawer?.setAttribute(
    "aria-hidden",
    "false"
  );


  menuButton?.setAttribute(
    "aria-expanded",
    "true"
  );


  document.body.classList.add(
    "drawer-open"
  );

}


function closeDrawer() {

  sideDrawer?.classList.remove(
    "open"
  );


  sideDrawer?.setAttribute(
    "aria-hidden",
    "true"
  );


  menuButton?.setAttribute(
    "aria-expanded",
    "false"
  );


  document.body.classList.remove(
    "drawer-open"
  );


  setTimeout(
    () => {

      if (
        drawerOverlay &&
        !sideDrawer?.classList.contains(
          "open"
        )
      ) {

        drawerOverlay.hidden =
          true;

      }

    },
    240
  );

}


menuButton?.addEventListener(
  "click",
  openDrawer
);


closeDrawerButton?.addEventListener(
  "click",
  closeDrawer
);


drawerOverlay?.addEventListener(
  "click",
  closeDrawer
);


document
  .querySelectorAll(
    "[data-drawer-nav]"
  )
  .forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          const destination =
            button.dataset
              .drawerNav;


          closeDrawer();


          setTimeout(
            () => {

              showScreen(
                destination
              );

            },
            120
          );

        }
      );

    }
  );


// ========================================
// NAVIGATION
// ========================================

const screens =
  document.querySelectorAll(
    ".screen"
  );


const bottomNavItems =
  document.querySelectorAll(
    ".bottom-nav .nav-item"
  );


const topLevelScreens = [

  "home",

  "budgets",

  "add",

  "trips",

  "calendar"

];


function showScreen(
  name
) {

  screens.forEach(
    (screen) => {

      screen.classList.toggle(
        "active",
        screen.dataset
          .screen ===
          name
      );

    }
  );


  bottomNavItems.forEach(
    (item) => {

      item.classList.toggle(
        "active",
        item.dataset.nav ===
          name &&
        topLevelScreens.includes(
          name
        )
      );

    }
  );


  if (
    name ===
    "add"
  ) {

    if (
      !openingExpenseEditor
    ) {

      resetExpenseForm();

    }


    prepareExpenseForm();


    openingExpenseEditor =
      false;

  }


  if (
    name ===
    "budgets"
  ) {

    renderBudgets();

  }


  if (
    name ===
    "trips"
  ) {

    renderTrips();

  }


  if (
    name ===
    "calendar"
  ) {

    renderCalendar();

  }


  if (
    name ===
    "reports"
  ) {

    renderReportSummary();

  }


  if (
    name ===
    "recurring"
  ) {

    renderRecurringExpenses();

  }


  if (
    name ===
    "backup"
  ) {

    renderBackupStatus();

  }


  if (
    name ===
    "planned"
  ) {

    renderPlannedExpenses();

  }


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}


document.addEventListener(
  "click",
  (event) => {

    const button =
      event.target.closest(
        "[data-nav]"
      );


    if (
      !button
    ) {

      return;

    }


    const destination =
      button.dataset.nav;


    if (
      destination
    ) {

      showScreen(
        destination
      );

    }


    if (
      button.hasAttribute(
        "data-focus-converter"
      )
    ) {

      setTimeout(
        () => {

          document
            .getElementById(
              "inlineConverter"
            )
            ?.scrollIntoView({
              behavior: "smooth",
              block: "center"
            });

        },
        250
      );

    }

  }
);


// ========================================
// CONVERTER
// ========================================

const converterCurrencyA =
  document.getElementById(
    "converterCurrencyA"
  );


const converterCurrencyB =
  document.getElementById(
    "converterCurrencyB"
  );


const converterAmountA =
  document.getElementById(
    "converterAmountA"
  );


const converterAmountB =
  document.getElementById(
    "converterAmountB"
  );


const converterTotalA =
  document.getElementById(
    "converterTotalA"
  );


const converterTotalB =
  document.getElementById(
    "converterTotalB"
  );


const converterSymbolA =
  document.getElementById(
    "converterSymbolA"
  );


const converterSymbolB =
  document.getElementById(
    "converterSymbolB"
  );


const converterRateText =
  document.getElementById(
    "converterRateText"
  );


function updateConverterSymbols() {

  converterSymbolA.textContent =
    CURRENCY_INFO[
      converterCurrencyA.value
    ].symbol;


  converterSymbolB.textContent =
    CURRENCY_INFO[
      converterCurrencyB.value
    ].symbol;

}


function updateConverterRateText() {

  const currencyA =
    converterCurrencyA.value;


  const currencyB =
    converterCurrencyB.value;


  const rate =
    convertCurrency(
      1,
      currencyA,
      currencyB
    );


  converterRateText.textContent =
    `${CURRENCY_INFO[currencyA].symbol}1 ≈ ` +
    `${CURRENCY_INFO[currencyB].symbol}` +
    `${formatPlainNumber(
      rate,
      currencyB
    )}`;

}


function setCalculatorTotal(
  element,
  value,
  currency
) {

  const row =
    element.closest(
      ".calculator-total-row"
    );


  if (
    value ===
    null
  ) {

    element.textContent =
      "Enter a valid calculation";


    row?.classList.add(
      "invalid"
    );


    return;

  }


  row?.classList.remove(
    "invalid"
  );


  element.textContent =
    formatCurrency(
      value,
      currency
    );

}


function updateConverterFromA() {

  if (
    converterIsUpdating
  ) {

    return;

  }


  converterEditingSide =
    "A";


  const totalA =
    calculateExpression(
      converterAmountA.value
    );


  setCalculatorTotal(
    converterTotalA,
    totalA,
    converterCurrencyA.value
  );


  if (
    totalA ===
    null
  ) {

    return;

  }


  const converted =
    convertCurrency(
      totalA,
      converterCurrencyA.value,
      converterCurrencyB.value
    );


  converterIsUpdating =
    true;


  converterAmountB.value =
    formatPlainNumber(
      converted,
      converterCurrencyB.value
    ).replaceAll(
      ",",
      ""
    );


  converterIsUpdating =
    false;


  setCalculatorTotal(
    converterTotalB,
    converted,
    converterCurrencyB.value
  );


  updateConverterRateText();

}


function updateConverterFromB() {

  if (
    converterIsUpdating
  ) {

    return;

  }


  converterEditingSide =
    "B";


  const totalB =
    calculateExpression(
      converterAmountB.value
    );


  setCalculatorTotal(
    converterTotalB,
    totalB,
    converterCurrencyB.value
  );


  if (
    totalB ===
    null
  ) {

    return;

  }


  const converted =
    convertCurrency(
      totalB,
      converterCurrencyB.value,
      converterCurrencyA.value
    );


  converterIsUpdating =
    true;


  converterAmountA.value =
    formatPlainNumber(
      converted,
      converterCurrencyA.value
    ).replaceAll(
      ",",
      ""
    );


  converterIsUpdating =
    false;


  setCalculatorTotal(
    converterTotalA,
    converted,
    converterCurrencyA.value
  );


  updateConverterRateText();

}


converterAmountA?.addEventListener(
  "input",
  updateConverterFromA
);


converterAmountB?.addEventListener(
  "input",
  updateConverterFromB
);


// ========================================
// CONVERTER OPERATOR BAR
// ========================================

function getConverterInputBySide(
  side
) {

  return (
    side ===
    "B"
      ? converterAmountB
      : converterAmountA
  );

}


function updateConverterBySide(
  side
) {

  if (
    side ===
    "B"
  ) {

    updateConverterFromB();

  } else {

    updateConverterFromA();

  }

}


function insertIntoConverterInput(
  input,
  value
) {

  if (
    !input
  ) {

    return;

  }


  const start =
    input.selectionStart ??
    input.value.length;


  const end =
    input.selectionEnd ??
    start;


  const before =
    input.value.slice(
      0,
      start
    );


  const after =
    input.value.slice(
      end
    );


  input.value =
    `${before}${value}${after}`;


  const nextPosition =
    start +
    value.length;


  input.focus();


  input.setSelectionRange(
    nextPosition,
    nextPosition
  );

}


function backspaceConverterInput(
  input
) {

  if (
    !input
  ) {

    return;

  }


  const start =
    input.selectionStart ??
    input.value.length;


  const end =
    input.selectionEnd ??
    start;


  if (
    start !==
    end
  ) {

    input.value =
      input.value.slice(
        0,
        start
      ) +
      input.value.slice(
        end
      );


    input.focus();


    input.setSelectionRange(
      start,
      start
    );


    return;

  }


  if (
    start <=
    0
  ) {

    input.focus();

    return;

  }


  const nextPosition =
    start -
    1;


  input.value =
    input.value.slice(
      0,
      nextPosition
    ) +
    input.value.slice(
      start
    );


  input.focus();


  input.setSelectionRange(
    nextPosition,
    nextPosition
  );

}


document
  .querySelectorAll(
    ".calculator-operator-bar"
  )
  .forEach(
    (bar) => {

      bar.addEventListener(
        "pointerdown",
        (event) => {

          /*
            Prevent iOS from moving focus away from
            the amount field when an operator is tapped.
          */

          if (
            event.target.closest(
              "button"
            )
          ) {

            event.preventDefault();

          }

        }
      );


      bar.addEventListener(
        "click",
        (event) => {

          const button =
            event.target.closest(
              "button"
            );


          if (
            !button
          ) {

            return;

          }


          const side =
            bar.dataset
              .calculatorTarget ||
            "A";


          const input =
            getConverterInputBySide(
              side
            );


          if (
            button.dataset
              .calcAction ===
            "backspace"
          ) {

            backspaceConverterInput(
              input
            );

          } else {

            const value =
              button.dataset
                .calcValue;


            if (
              value
            ) {

              insertIntoConverterInput(
                input,
                value
              );

            }

          }


          converterEditingSide =
            side;


          updateConverterBySide(
            side
          );

        }
      );

    }
  );


function handleConverterCurrencyChange() {

  updateConverterSymbols();


  localStorage.setItem(
    LOCAL_KEYS.converterA,
    converterCurrencyA.value
  );


  localStorage.setItem(
    LOCAL_KEYS.converterB,
    converterCurrencyB.value
  );


  if (
    converterEditingSide ===
    "B"
  ) {

    updateConverterFromB();

  } else {

    updateConverterFromA();

  }

}


converterCurrencyA?.addEventListener(
  "change",
  handleConverterCurrencyChange
);


converterCurrencyB?.addEventListener(
  "change",
  handleConverterCurrencyChange
);


document
  .getElementById(
    "swapCurrencies"
  )
  ?.addEventListener(
    "click",
    () => {

      const currencyA =
        converterCurrencyA.value;


      const currencyB =
        converterCurrencyB.value;


      const expressionA =
        converterAmountA.value;


      const expressionB =
        converterAmountB.value;


      converterCurrencyA.value =
        currencyB;


      converterCurrencyB.value =
        currencyA;


      converterAmountA.value =
        expressionB;


      converterAmountB.value =
        expressionA;


      converterEditingSide =
        "A";


      updateConverterSymbols();

      updateConverterFromA();


      localStorage.setItem(
        LOCAL_KEYS.converterA,
        converterCurrencyA.value
      );


      localStorage.setItem(
        LOCAL_KEYS.converterB,
        converterCurrencyB.value
      );

    }
  );


function clearConverter() {

  converterAmountA.value =
    "";


  converterAmountB.value =
    "";


  converterTotalA.textContent =
    formatCurrency(
      0,
      converterCurrencyA.value
    );


  converterTotalB.textContent =
    formatCurrency(
      0,
      converterCurrencyB.value
    );

}


document
  .getElementById(
    "clearConverterA"
  )
  ?.addEventListener(
    "click",
    () => {

      clearConverter();

      converterAmountA.focus();

    }
  );


document
  .getElementById(
    "clearConverterB"
  )
  ?.addEventListener(
    "click",
    () => {

      clearConverter();

      converterAmountB.focus();

    }
  );


function initializeConverter() {

  const savedA =
    localStorage.getItem(
      LOCAL_KEYS.converterA
    );


  const savedB =
    localStorage.getItem(
      LOCAL_KEYS.converterB
    );


  converterCurrencyA.value =
    savedA &&
    EXCHANGE_RATES[
      savedA
    ]

      ? savedA

      : "JPY";


  converterCurrencyB.value =
    savedB &&
    EXCHANGE_RATES[
      savedB
    ]

      ? savedB

      : "PHP";


  if (
    converterCurrencyA.value ===
    converterCurrencyB.value
  ) {

    converterCurrencyA.value =
      "JPY";


    converterCurrencyB.value =
      "PHP";

  }


  converterAmountA.value =
    "";


  converterAmountB.value =
    "";


  updateConverterSymbols();

  updateConverterRateText();

}


// ========================================
// EXPENSE CURRENCY PREVIEW
// ========================================

const amountInput =
  document.getElementById(
    "amount"
  );


const currencySelect =
  document.getElementById(
    "currency"
  );


const convertedAmount =
  document.getElementById(
    "convertedAmount"
  );


function updateExpenseConversion() {

  if (
    !amountInput ||
    !currencySelect ||
    !convertedAmount
  ) {

    return;

  }


  const amount =
    Number(
      amountInput.value ||
      0
    );


  const currency =
    currencySelect.value;


  if (
    currency ===
    "PHP"
  ) {

    convertedAmount.textContent =
      "Home currency";


    return;

  }


  const converted =
    convertCurrency(
      amount,
      currency,
      "PHP"
    );


  convertedAmount.textContent =
    `≈ ${formatPHP(
      converted
    )}`;

}


amountInput?.addEventListener(
  "input",
  updateExpenseConversion
);


currencySelect?.addEventListener(
  "change",
  updateExpenseConversion
);


// ========================================
// BUDGET PERIOD LOGIC
// ========================================

function isExpenseInsideBudgetPeriod(
  expense,
  budget
) {

  const expenseDate =
    createLocalDate(
      expense.date
    );


  const today =
    new Date();


  today.setHours(
    0,
    0,
    0,
    0
  );


  if (
    budget.period ===
    "daily"
  ) {

    return (

      expenseDate.getFullYear() ===
        today.getFullYear() &&

      expenseDate.getMonth() ===
        today.getMonth() &&

      expenseDate.getDate() ===
        today.getDate()

    );

  }


  if (
    budget.period ===
    "weekly"
  ) {

    const start =
      new Date(
        today
      );


    const weekday =
      start.getDay();


    start.setDate(
      start.getDate() +
      (
        weekday ===
        0

          ? -6

          : 1 -
            weekday
      )
    );


    const end =
      new Date(
        start
      );


    end.setDate(
      start.getDate() +
      6
    );


    return (
      expenseDate >=
        start &&
      expenseDate <=
        end
    );

  }


  if (
    budget.period ===
    "monthly"
  ) {

    return (

      expenseDate.getFullYear() ===
        today.getFullYear() &&

      expenseDate.getMonth() ===
        today.getMonth()

    );

  }


  if (
    budget.period ===
    "yearly"
  ) {

    return (
      expenseDate.getFullYear() ===
      today.getFullYear()
    );

  }


  if (
    budget.period ===
    "custom"
  ) {

    if (
      !budget.startDate ||
      !budget.endDate
    ) {

      return false;

    }


    const start =
      createLocalDate(
        budget.startDate
      );


    const end =
      createLocalDate(
        budget.endDate
      );


    end.setHours(
      23,
      59,
      59,
      999
    );


    return (
      expenseDate >=
        start &&
      expenseDate <=
        end
    );

  }


  return false;

}


// ========================================
// BUDGET CALCULATIONS
// ========================================

function getBudgetSpent(
  budget
) {

  return expenses

    .filter(
      (expense) =>

        expense.budgetId ===
          budget.id &&

        isExpenseInsideBudgetPeriod(
          expense,
          budget
        )
    )

    .reduce(
      (
        total,
        expense
      ) => {

        return (
          total +
          convertCurrency(
            expense.amount,
            expense.currency,
            budget.currency
          )
        );

      },
      0
    );

}


function getPeriodLabel(
  budget
) {

  switch (
    budget.period
  ) {

    case "daily":

      return "Daily";


    case "weekly":

      return "Weekly";


    case "monthly":

      return "Monthly";


    case "yearly":

      return "Yearly";


    case "custom":

      if (
        budget.startDate &&
        budget.endDate
      ) {

        return `${formatDate(
          budget.startDate
        )} – ${formatDate(
          budget.endDate
        )}`;

      }


      return "Custom";


    default:

      return "";

  }

}


function getCategoryEmoji(
  category
) {

  const map = {

    Transportation:
      "🚗",

    "Food & Drinks":
      "🍜",

    Groceries:
      "🛒",

    Shopping:
      "🛍️",

    Beauty:
      "🧴",

    Entertainment:
      "🎬",

    Bills:
      "🧾",

    Subscriptions:
      "📱",

    Travel:
      "✈️",

    Education:
      "📚",

    Other:
      "🍑"

  };


  return (
    map[
      category
    ] ||
    "🍑"
  );

}


// ========================================
// BUDGET CARD HTML
// ========================================

function createBudgetCardHTML(
  budget,
  compact =
    false
) {

  const spent =
    getBudgetSpent(
      budget
    );


  const remaining =
    Math.max(
      Number(
        budget.amount
      ) -
      spent,
      0
    );


  const percent =
    Number(
      budget.amount
    ) >
    0

      ? Math.min(
          (
            spent /
            Number(
              budget.amount
            )
          ) *
            100,
          100
        )

      : 0;


  return `

    <article class="budget-card">

      <div class="budget-card-top">

        <div class="budget-card-title">

          <div class="budget-emoji">

            ${getCategoryEmoji(
              budget.category
            )}

          </div>


          <div>

            <h3>

              ${escapeHTML(
                budget.name
              )}

            </h3>


            <span class="budget-card-meta">

              ${escapeHTML(
                budget.category
              )}

              •

              ${escapeHTML(
                getPeriodLabel(
                  budget
                )
              )}

            </span>

          </div>

        </div>


        ${
          compact

            ? ""

            : `

              <div class="budget-actions">

                <button
                  class="tiny-btn edit-budget"
                  type="button"
                  data-budget-id="${escapeHTML(
                    budget.id
                  )}"
                >
                  ✎
                </button>


                <button
                  class="tiny-btn delete-budget"
                  type="button"
                  data-budget-id="${escapeHTML(
                    budget.id
                  )}"
                >
                  🗑
                </button>

              </div>

            `
        }

      </div>


      <div class="budget-numbers">

        <div>

          <span>
            Spent
          </span>

          <strong>

            ${formatCurrency(
              spent,
              budget.currency
            )}

          </strong>

        </div>


        <div>

          <span>
            Left
          </span>

          <strong class="positive">

            ${formatCurrency(
              remaining,
              budget.currency
            )}

          </strong>

        </div>

      </div>


      <div class="progress-track">

        <div
          class="progress-fill"
          style="width:${percent}%"
        ></div>

      </div>


      <div class="budget-period-label">

        ${formatCurrency(
          budget.amount,
          budget.currency
        )}

        limit

      </div>

    </article>

  `;

}


// ========================================
// RENDER BUDGETS
// ========================================

const budgetList =
  document.getElementById(
    "budgetList"
  );


const homeBudgetList =
  document.getElementById(
    "homeBudgetList"
  );


function renderBudgets() {

  let visibleBudgets =
    budgets;


  if (
    activeBudgetFilter !==
    "all"
  ) {

    visibleBudgets =
      budgets.filter(
        (budget) =>
          budget.period ===
          activeBudgetFilter
      );

  }


  if (
    budgetList
  ) {

    if (
      visibleBudgets.length ===
      0
    ) {

      budgetList.innerHTML = `

        <div class="empty-panel">

          <span class="empty-icon">
            ♡
          </span>

          <h3>
            No budgets yet
          </h3>

          <p>
            Tap + to create your first budget.
          </p>

        </div>

      `;

    } else {

      budgetList.innerHTML =
        visibleBudgets

          .map(
            (budget) =>
              createBudgetCardHTML(
                budget,
                false
              )
          )

          .join("");

    }

  }


  if (
    homeBudgetList
  ) {

    if (
      budgets.length ===
      0
    ) {

      homeBudgetList.innerHTML = `

        <div class="empty-panel compact-empty">

          <span class="empty-icon">
            ♡
          </span>

          <h3>
            No budgets yet
          </h3>

          <p>
            Create one when you're ready to set a spending limit.
          </p>

        </div>

      `;

    } else {

      homeBudgetList.innerHTML =
        budgets

          .slice(
            0,
            3
          )

          .map(
            (budget) =>
              createBudgetCardHTML(
                budget,
                true
              )
          )

          .join("");

    }

  }


  attachBudgetActions();

  populateExpenseBudgetDropdown();

}


// ========================================
// BUDGET FILTERS
// ========================================

document
  .querySelectorAll(
    "[data-budget-filter]"
  )
  .forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          document
            .querySelectorAll(
              "[data-budget-filter]"
            )
            .forEach(
              (item) => {

                item.classList.remove(
                  "active"
                );

              }
            );


          button.classList.add(
            "active"
          );


          activeBudgetFilter =
            button.dataset
              .budgetFilter;


          renderBudgets();

        }
      );

    }
  );


// ========================================
// EXPENSE BUDGET DROPDOWN
// ========================================

const expenseBudget =
  document.getElementById(
    "expenseBudget"
  );


const expenseCategory =
  document.getElementById(
    "expenseCategory"
  );


function populateExpenseBudgetDropdown() {

  if (
    !expenseBudget
  ) {

    return;

  }


  const options =
    budgets

      .map(
        (budget) => `

          <option
            value="${escapeHTML(
              budget.id
            )}"
          >

            ${escapeHTML(
              budget.name
            )}

            —

            ${formatCurrency(
              budget.amount,
              budget.currency
            )}

          </option>

        `
      )

      .join("");


  expenseBudget.innerHTML = `

    <option value="">
      No budget
    </option>

    ${options}

  `;

}


// ========================================
// EXPENSE TRIP DROPDOWN
// ========================================

const expenseTrip =
  document.getElementById(
    "expenseTrip"
  );


function populateExpenseTripDropdown() {

  if (
    !expenseTrip
  ) {

    return;

  }


  const currentValue =
    expenseTrip.value;


  const options =
    trips

      .map(
        (trip) => `

          <option
            value="${escapeHTML(
              trip.id
            )}"
          >

            ${escapeHTML(
              trip.name
            )}

            ${
              trip.destination
                ? `— ${escapeHTML(
                    trip.destination
                  )}`
                : ""
            }

          </option>

        `
      )

      .join("");


  expenseTrip.innerHTML = `

    <option value="">
      Personal / No Trip
    </option>

    ${options}

  `;


  if (
    currentValue &&
    trips.some(
      (trip) =>
        trip.id ===
        currentValue
    )
  ) {

    expenseTrip.value =
      currentValue;

  }

}


expenseBudget?.addEventListener(
  "change",
  () => {

    const budget =
      budgets.find(
        (item) =>
          item.id ===
          expenseBudget.value
      );


    if (
      !budget
    ) {

      return;

    }


    expenseCategory.value =
      budget.category;


    currencySelect.value =
      budget.currency;


    updateExpenseConversion();

  }
);


// ========================================
// BUDGET MODAL
// ========================================

const budgetModal =
  document.getElementById(
    "budgetModal"
  );


const budgetForm =
  document.getElementById(
    "budgetForm"
  );


const budgetId =
  document.getElementById(
    "budgetId"
  );


const budgetName =
  document.getElementById(
    "budgetName"
  );


const budgetCategory =
  document.getElementById(
    "budgetCategory"
  );


const budgetAmount =
  document.getElementById(
    "budgetAmount"
  );


const budgetCurrency =
  document.getElementById(
    "budgetCurrency"
  );


const budgetPeriod =
  document.getElementById(
    "budgetPeriod"
  );


const budgetStartDate =
  document.getElementById(
    "budgetStartDate"
  );


const budgetEndDate =
  document.getElementById(
    "budgetEndDate"
  );


const customDateFields =
  document.getElementById(
    "customDateFields"
  );


function updateCustomDateVisibility() {

  const custom =
    budgetPeriod.value ===
    "custom";


  customDateFields.hidden =
    !custom;


  budgetStartDate.required =
    custom;


  budgetEndDate.required =
    custom;

}


function openBudgetModal(
  budget =
    null
) {

  budgetModal.hidden =
    false;


  if (
    budget
  ) {

    document
      .getElementById(
        "budgetModalTitle"
      )
      .textContent =
      "Edit Budget";


    budgetId.value =
      budget.id;


    budgetName.value =
      budget.name;


    budgetCategory.value =
      budget.category;


    budgetAmount.value =
      budget.amount;


    budgetCurrency.value =
      budget.currency;


    budgetPeriod.value =
      budget.period;


    budgetStartDate.value =
      budget.startDate ||
      "";


    budgetEndDate.value =
      budget.endDate ||
      "";

  } else {

    budgetForm.reset();


    document
      .getElementById(
        "budgetModalTitle"
      )
      .textContent =
      "Add Budget";


    budgetId.value =
      "";


    budgetCurrency.value =
      "PHP";


    budgetPeriod.value =
      "monthly";

  }


  updateCustomDateVisibility();

}


function closeBudgetModal() {

  budgetModal.hidden =
    true;

}


document
  .getElementById(
    "addBudgetButton"
  )
  ?.addEventListener(
    "click",
    () => {

      openBudgetModal();

    }
  );


document
  .getElementById(
    "closeBudgetModal"
  )
  ?.addEventListener(
    "click",
    closeBudgetModal
  );


budgetModal?.addEventListener(
  "click",
  (event) => {

    if (
      event.target ===
      budgetModal
    ) {

      closeBudgetModal();

    }

  }
);


budgetPeriod?.addEventListener(
  "change",
  updateCustomDateVisibility
);


// ========================================
// SAVE BUDGET
// ========================================

budgetForm?.addEventListener(
  "submit",
  async (
    event
  ) => {

    event.preventDefault();


    const existingId =
      budgetId.value;


    const previous =
      budgets.find(
        (item) =>
          item.id ===
          existingId
      );


    const budget = {

      id:
        existingId ||
        generateId(
          "budget"
        ),

      name:
        budgetName.value
          .trim(),

      category:
        budgetCategory.value,

      amount:
        Number(
          budgetAmount.value
        ),

      currency:
        budgetCurrency.value,

      period:
        budgetPeriod.value,

      startDate:
        budgetPeriod.value ===
        "custom"

          ? budgetStartDate.value

          : "",

      endDate:
        budgetPeriod.value ===
        "custom"

          ? budgetEndDate.value

          : "",

      createdAt:
        previous?.createdAt ||
        new Date()
          .toISOString(),

      updatedAt:
        new Date()
          .toISOString()

    };


    await putRecord(
      STORES.budgets,
      budget
    );


    await loadAppData();


    closeBudgetModal();

    renderAll();


    showToast(
      existingId

        ? "Budget updated ✨"

        : "Budget added 🍑"
    );

  }
);


// ========================================
// EDIT / DELETE BUDGET
// ========================================

function attachBudgetActions() {

  document
    .querySelectorAll(
      ".edit-budget"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          (event) => {

            event.stopPropagation();

            const budget =
              budgets.find(
                (item) =>
                  item.id ===
                  button.dataset
                    .budgetId
              );


            if (
              budget
            ) {

              openBudgetModal(
                budget
              );

            }

          }
        );

      }
    );


  document
    .querySelectorAll(
      ".delete-budget"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          (event) => {

            event.stopPropagation();

            budgetPendingDelete =
              button.dataset
                .budgetId;


            document
              .getElementById(
                "deleteModal"
              )
              .hidden =
              false;

          }
        );

      }
    );

}


document
  .getElementById(
    "cancelDelete"
  )
  ?.addEventListener(
    "click",
    () => {

      budgetPendingDelete =
        null;


      document
        .getElementById(
          "deleteModal"
        )
        .hidden =
        true;

    }
  );


document
  .getElementById(
    "confirmDelete"
  )
  ?.addEventListener(
    "click",
    async () => {

      if (
        !budgetPendingDelete
      ) {

        return;

      }


      await deleteRecord(
        STORES.budgets,
        budgetPendingDelete
      );


      budgetPendingDelete =
        null;


      document
        .getElementById(
          "deleteModal"
        )
        .hidden =
        true;


      await loadAppData();


      renderAll();


      showToast(
        "Budget deleted"
      );

    }
  );


// ========================================
// TRIP HELPERS
// ========================================

function getTripStatus(
  trip
) {

  const today =
    new Date();


  today.setHours(
    0,
    0,
    0,
    0
  );


  const start =
    createLocalDate(
      trip.startDate
    );


  const end =
    createLocalDate(
      trip.endDate
    );


  end.setHours(
    23,
    59,
    59,
    999
  );


  if (
    today <
    start
  ) {

    return "Upcoming";

  }


  if (
    today >
    end
  ) {

    return "Past";

  }


  return "Current";

}


function getTripDuration(
  trip
) {

  const start =
    createLocalDate(
      trip.startDate
    );


  const end =
    createLocalDate(
      trip.endDate
    );


  const difference =
    end -
    start;


  const days =
    Math.floor(
      difference /
      (
        1000 *
        60 *
        60 *
        24
      )
    ) +
    1;


  return Math.max(
    days,
    1
  );

}


function getTripSpent(
  trip
) {

  /*
    Trip spending is calculated from expenses
    linked to this trip through tripId.
  */

  return expenses

    .filter(
      (expense) =>
        expense.tripId ===
        trip.id
    )

    .reduce(
      (
        total,
        expense
      ) => {

        return (
          total +
          convertCurrency(
            expense.amount,
            expense.currency,
            trip.currency
          )
        );

      },
      0
    );

}


function createTripCardHTML(
  trip
) {

  const status =
    getTripStatus(
      trip
    );


  const duration =
    getTripDuration(
      trip
    );


  const spent =
    getTripSpent(
      trip
    );


  const remaining =
    Math.max(
      Number(
        trip.budget
      ) -
      spent,
      0
    );


  const percentage =
    Number(
      trip.budget
    ) >
    0

      ? Math.min(
          (
            spent /
            Number(
              trip.budget
            )
          ) *
            100,
          100
        )

      : 0;


  const dailyBudget =
    Number(
      trip.dailyBudget ||
      0
    );


  return `

    <article class="trip-entry-card">

      <div class="trip-entry-banner">

        <div class="trip-entry-top">

          <span class="trip-status-pill">

            ${escapeHTML(
              status
            )}

          </span>


          <div class="trip-entry-actions">

            <button
              class="trip-banner-btn edit-trip"
              type="button"
              data-trip-id="${escapeHTML(
                trip.id
              )}"
              aria-label="Edit trip"
            >
              ✎
            </button>


            <button
              class="trip-banner-btn delete-trip"
              type="button"
              data-trip-id="${escapeHTML(
                trip.id
              )}"
              aria-label="Delete trip"
            >
              🗑
            </button>

          </div>

        </div>


        <div class="trip-entry-copy">

          <p class="eyebrow light">

            ${escapeHTML(
              trip.destination
            )}

          </p>


          <h2>

            ${escapeHTML(
              trip.name
            )}

            ✈️

          </h2>


          <p>

            ${formatDate(
              trip.startDate
            )}

            –

            ${formatDate(
              trip.endDate
            )}

          </p>

        </div>

      </div>


      <div class="trip-entry-body">

        <div class="trip-info-row">

          <div class="trip-info-cell">

            <span>
              Budget
            </span>

            <strong>

              ${formatCurrency(
                trip.budget,
                trip.currency
              )}

            </strong>

          </div>


          <div class="trip-info-cell">

            <span>
              Spent
            </span>

            <strong>

              ${formatCurrency(
                spent,
                trip.currency
              )}

            </strong>

          </div>


          <div class="trip-info-cell">

            <span>
              Left
            </span>

            <strong class="positive">

              ${formatCurrency(
                remaining,
                trip.currency
              )}

            </strong>

          </div>

        </div>


        <div class="progress-track">

          <div
            class="progress-fill"
            style="width:${percentage}%"
          ></div>

        </div>


        <div class="trip-daily-row">

          <span>

            ${duration}
            ${duration === 1 ? "day" : "days"}

          </span>


          <span>

            Daily budget:

            <strong>

              ${
                dailyBudget >
                0

                  ? formatCurrency(
                      dailyBudget,
                      trip.currency
                    )

                  : "Not set"
              }

            </strong>

          </span>

        </div>


        ${
          trip.notes

            ? `

              <p class="trip-notes-preview">

                ${escapeHTML(
                  trip.notes
                )}

              </p>

            `

            : ""
        }

      </div>

    </article>

  `;

}


// ========================================
// RENDER TRIPS
// ========================================

const tripList =
  document.getElementById(
    "tripList"
  );


const homeTripSnapshot =
  document.getElementById(
    "homeTripSnapshot"
  );


function renderTrips() {

  if (
    tripList
  ) {

    if (
      trips.length ===
      0
    ) {

      tripList.innerHTML = `

        <div class="empty-panel">

          <span class="empty-icon">
            ✈️
          </span>

          <h3>
            No trips yet
          </h3>

          <p>
            Tap + to add your first trip.
          </p>

        </div>

      `;

    } else {

      tripList.innerHTML =
        trips

          .map(
            createTripCardHTML
          )

          .join("");

    }

  }


  renderHomeTripSnapshot();


  attachTripActions();

}


// ========================================
// HOME TRIP SNAPSHOT
// ========================================

function renderHomeTripSnapshot() {

  if (
    !homeTripSnapshot
  ) {

    return;

  }


  if (
    trips.length ===
    0
  ) {

    homeTripSnapshot.innerHTML = `

      <div class="empty-panel compact-empty">

        <span class="empty-icon">
          ✈️
        </span>

        <h3>
          No trips yet
        </h3>

        <p>
          Create a trip and it will appear here.
        </p>

      </div>

    `;


    return;

  }


  const today =
    new Date();


  today.setHours(
    0,
    0,
    0,
    0
  );


  const currentTrips =
    trips.filter(
      (trip) =>
        getTripStatus(
          trip
        ) ===
        "Current"
    );


  const upcomingTrips =
    trips.filter(
      (trip) =>
        createLocalDate(
          trip.startDate
        ) >=
        today
    );


  const trip =
    currentTrips[0] ||
    upcomingTrips[0] ||
    trips[
      trips.length -
      1
    ];


  const spent =
    getTripSpent(
      trip
    );


  const remaining =
    Math.max(
      Number(
        trip.budget
      ) -
      spent,
      0
    );


  homeTripSnapshot.innerHTML = `

    <button
      class="home-trip-card"
      type="button"
      data-nav="trips"
    >

      <div class="home-trip-banner">

        <p class="eyebrow light">

          ${escapeHTML(
            getTripStatus(
              trip
            )
          )}

        </p>


        <h3>

          ${escapeHTML(
            trip.name
          )}

          ✈️

        </h3>


        <p>

          ${escapeHTML(
            trip.destination
          )}

          ·

          ${formatShortDate(
            trip.startDate
          )}

          –

          ${formatShortDate(
            trip.endDate
          )}

        </p>

      </div>


      <div class="home-trip-stats">

        <div>

          <span>
            Budget
          </span>

          <strong>

            ${formatCurrency(
              trip.budget,
              trip.currency
            )}

          </strong>

        </div>


        <div>

          <span>
            Spent
          </span>

          <strong>

            ${formatCurrency(
              spent,
              trip.currency
            )}

          </strong>

        </div>


        <div>

          <span>
            Left
          </span>

          <strong class="positive">

            ${formatCurrency(
              remaining,
              trip.currency
            )}

          </strong>

        </div>

      </div>

    </button>

  `;

}


// ========================================
// TRIP MODAL
// ========================================

const tripModal =
  document.getElementById(
    "tripModal"
  );


const tripForm =
  document.getElementById(
    "tripForm"
  );


const tripId =
  document.getElementById(
    "tripId"
  );


const tripName =
  document.getElementById(
    "tripName"
  );


const tripDestination =
  document.getElementById(
    "tripDestination"
  );


const tripStartDate =
  document.getElementById(
    "tripStartDate"
  );


const tripEndDate =
  document.getElementById(
    "tripEndDate"
  );


const tripBudget =
  document.getElementById(
    "tripBudget"
  );


const tripCurrency =
  document.getElementById(
    "tripCurrency"
  );


const tripDailyBudget =
  document.getElementById(
    "tripDailyBudget"
  );


const tripNotes =
  document.getElementById(
    "tripNotes"
  );


function openTripModal(
  trip =
    null
) {

  tripModal.hidden =
    false;


  if (
    trip
  ) {

    document
      .getElementById(
        "tripModalTitle"
      )
      .textContent =
      "Edit Trip";


    tripId.value =
      trip.id;


    tripName.value =
      trip.name;


    tripDestination.value =
      trip.destination;


    tripStartDate.value =
      trip.startDate;


    tripEndDate.value =
      trip.endDate;


    tripBudget.value =
      trip.budget;


    tripCurrency.value =
      trip.currency;


    tripDailyBudget.value =
      trip.dailyBudget ||
      "";


    tripNotes.value =
      trip.notes ||
      "";

  } else {

    tripForm.reset();


    document
      .getElementById(
        "tripModalTitle"
      )
      .textContent =
      "Add Trip";


    tripId.value =
      "";


    tripCurrency.value =
      "JPY";

  }

}


function closeTripModal() {

  tripModal.hidden =
    true;

}


document
  .getElementById(
    "addTripButton"
  )
  ?.addEventListener(
    "click",
    () => {

      openTripModal();

    }
  );


document
  .getElementById(
    "closeTripModal"
  )
  ?.addEventListener(
    "click",
    closeTripModal
  );


tripModal?.addEventListener(
  "click",
  (event) => {

    if (
      event.target ===
      tripModal
    ) {

      closeTripModal();

    }

  }
);


// ========================================
// SAVE TRIP
// ========================================

tripForm?.addEventListener(
  "submit",
  async (
    event
  ) => {

    event.preventDefault();


    const start =
      createLocalDate(
        tripStartDate.value
      );


    const end =
      createLocalDate(
        tripEndDate.value
      );


    if (
      end <
      start
    ) {

      showToast(
        "End date can't be before the start date."
      );


      return;

    }


    const existingId =
      tripId.value;


    const previous =
      trips.find(
        (item) =>
          item.id ===
          existingId
      );


    const trip = {

      id:
        existingId ||
        generateId(
          "trip"
        ),

      name:
        tripName.value
          .trim(),

      destination:
        tripDestination.value
          .trim(),

      startDate:
        tripStartDate.value,

      endDate:
        tripEndDate.value,

      budget:
        Number(
          tripBudget.value
        ),

      currency:
        tripCurrency.value,

      dailyBudget:
        tripDailyBudget.value

          ? Number(
              tripDailyBudget.value
            )

          : 0,

      notes:
        tripNotes.value
          .trim(),

      createdAt:
        previous?.createdAt ||
        new Date()
          .toISOString(),

      updatedAt:
        new Date()
          .toISOString()

    };


    await putRecord(
      STORES.trips,
      trip
    );


    await loadAppData();


    closeTripModal();


    renderAll();


    showToast(
      existingId

        ? "Trip updated ✨"

        : "Trip added ✈️"
    );

  }
);


// ========================================
// EDIT / DELETE TRIPS
// ========================================

function attachTripActions() {

  document
    .querySelectorAll(
      ".edit-trip"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const trip =
              trips.find(
                (item) =>
                  item.id ===
                  button.dataset
                    .tripId
              );


            if (
              trip
            ) {

              openTripModal(
                trip
              );

            }

          }
        );

      }
    );


  document
    .querySelectorAll(
      ".delete-trip"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            tripPendingDelete =
              button.dataset
                .tripId;


            document
              .getElementById(
                "deleteTripModal"
              )
              .hidden =
              false;

          }
        );

      }
    );

}


document
  .getElementById(
    "cancelDeleteTrip"
  )
  ?.addEventListener(
    "click",
    () => {

      tripPendingDelete =
        null;


      document
        .getElementById(
          "deleteTripModal"
        )
        .hidden =
        true;

    }
  );


document
  .getElementById(
    "confirmDeleteTrip"
  )
  ?.addEventListener(
    "click",
    async () => {

      if (
        !tripPendingDelete
      ) {

        return;

      }


      await deleteRecord(
        STORES.trips,
        tripPendingDelete
      );


      tripPendingDelete =
        null;


      document
        .getElementById(
          "deleteTripModal"
        )
        .hidden =
        true;


      await loadAppData();


      renderAll();


      showToast(
        "Trip deleted"
      );

    }
  );


// ========================================
// PHOTO
// ========================================

const expensePhoto =
  document.getElementById(
    "expensePhoto"
  );


const photoPreview =
  document.getElementById(
    "photoPreview"
  );


function readFileAsDataURL(
  file
) {

  return new Promise(
    (resolve, reject) => {

      const reader =
        new FileReader();


      reader.onload =
        () => {

          resolve(
            reader.result
          );

        };


      reader.onerror =
        () => {

          reject(
            reader.error
          );

        };


      reader.readAsDataURL(
        file
      );

    }
  );

}


function loadImageFromFile(
  file
) {

  return new Promise(
    (resolve, reject) => {

      const image =
        new Image();


      const objectURL =
        URL.createObjectURL(
          file
        );


      image.onload =
        () => {

          URL.revokeObjectURL(
            objectURL
          );


          resolve(
            image
          );

        };


      image.onerror =
        () => {

          URL.revokeObjectURL(
            objectURL
          );


          reject(
            new Error(
              "Could not read image"
            )
          );

        };


      image.src =
        objectURL;

    }
  );

}


async function compressExpensePhoto(
  file
) {

  const image =
    await loadImageFromFile(
      file
    );


  const originalWidth =
    image.naturalWidth ||
    image.width;


  const originalHeight =
    image.naturalHeight ||
    image.height;


  if (
    !originalWidth ||
    !originalHeight
  ) {

    throw new Error(
      "Invalid image dimensions"
    );

  }


  const scale =
    Math.min(
      1,
      PHOTO_MAX_DIMENSION /
        Math.max(
          originalWidth,
          originalHeight
        )
    );


  const targetWidth =
    Math.max(
      1,
      Math.round(
        originalWidth *
        scale
      )
    );


  const targetHeight =
    Math.max(
      1,
      Math.round(
        originalHeight *
        scale
      )
    );


  const canvas =
    document.createElement(
      "canvas"
    );


  canvas.width =
    targetWidth;


  canvas.height =
    targetHeight;


  const context =
    canvas.getContext(
      "2d",
      {
        alpha: false
      }
    );


  if (
    !context
  ) {

    throw new Error(
      "Canvas is unavailable"
    );

  }


  context.fillStyle =
    "#ffffff";


  context.fillRect(
    0,
    0,
    targetWidth,
    targetHeight
  );


  context.drawImage(
    image,
    0,
    0,
    targetWidth,
    targetHeight
  );


  return canvas.toDataURL(
    "image/jpeg",
    PHOTO_JPEG_QUALITY
  );

}


function renderExpensePhotoPreview(
  photoData =
    ""
) {

  if (
    !photoPreview
  ) {

    return;

  }


  photoPreview.innerHTML =
    photoData

      ? `

          <img
            src="${photoData}"
            alt="Expense photo"
          >

        `

      : "📸";

}


expensePhoto?.addEventListener(
  "change",
  () => {

    const file =
      expensePhoto.files?.[
        0
      ];


    if (
      !file
    ) {

      return;

    }


    if (
      !file.type.startsWith(
        "image/"
      )
    ) {

      expensePhoto.value =
        "";


      showToast(
        "Please choose an image."
      );


      return;

    }


    photoProcessingPromise =
      (
        async () => {

          try {

            showToast(
              "Optimizing photo…"
            );


            const compressed =
              await compressExpensePhoto(
                file
              );


            currentPhotoData =
              compressed;


            renderExpensePhotoPreview(
              currentPhotoData
            );


            showToast(
              "Photo ready 📸"
            );

          } catch (
            error
          ) {

            console.error(
              "Photo compression failed:",
              error
            );


            try {

              /*
                Fallback keeps photo attachment usable
                if an iPhone/browser cannot decode a
                particular image format through canvas.
              */

              currentPhotoData =
                await readFileAsDataURL(
                  file
                );


              renderExpensePhotoPreview(
                currentPhotoData
              );


              showToast(
                "Photo ready 📸"
              );

            } catch (
              fallbackError
            ) {

              console.error(
                "Photo fallback failed:",
                fallbackError
              );


              currentPhotoData =
                "";


              expensePhoto.value =
                "";


              renderExpensePhotoPreview();


              showToast(
                "Could not attach that photo."
              );

            }

          } finally {

            photoProcessingPromise =
              null;

          }

        }
      )();

  }
);


// ========================================
// EXPENSE FORM
// ========================================

const expenseDate =
  document.getElementById(
    "expenseDate"
  );


const expenseForm =
  document.getElementById(
    "expenseForm"
  );


const expenseIdInput =
  document.getElementById(
    "expenseId"
  );


const expenseFormTitle =
  document.getElementById(
    "expenseFormTitle"
  );


function setExpenseFormMode(
  mode =
    "add"
) {

  const isEditing =
    mode ===
    "edit";


  if (
    expenseFormTitle
  ) {

    expenseFormTitle.textContent =
      isEditing
        ? "Edit Expense"
        : "Add Expense";

  }

}


function resetExpenseForm() {

  editingExpenseId =
    "";


  if (
    !openingExpenseEditor
  ) {

    pendingPlannedConversionId =
      "";

  }


  expenseForm?.reset();


  if (
    expenseIdInput
  ) {

    expenseIdInput.value =
      "";

  }


  currentPhotoData =
    "";


  photoProcessingPromise =
    null;


  if (
    expensePhoto
  ) {

    expensePhoto.value =
      "";

  }


  renderExpensePhotoPreview();


  setExpenseFormMode(
    "add"
  );


  if (
    expenseDate
  ) {

    expenseDate.value =
      getTodayString();

  }


  if (
    currencySelect
  ) {

    currencySelect.value =
      "PHP";

  }


  updateExpenseConversion();

}


function prepareExpenseForm() {

  populateExpenseBudgetDropdown();

  populateExpenseTripDropdown();


  if (
    expenseDate &&
    !expenseDate.value
  ) {

    expenseDate.value =
      getTodayString();

  }

}


function openExpenseEditor(
  expense
) {

  if (
    !expense
  ) {

    return;

  }


  editingExpenseId =
    expense.id;


  openingExpenseEditor =
    true;


  showScreen(
    "add"
  );


  if (
    expenseIdInput
  ) {

    expenseIdInput.value =
      expense.id;

  }


  setExpenseFormMode(
    "edit"
  );


  document
    .getElementById(
      "expenseTitle"
    )
    .value =
    expense.title ||
    "";


  amountInput.value =
    expense.amount ??
    "";


  currencySelect.value =
    expense.currency ||
    "PHP";


  expenseCategory.value =
    expense.category ||
    "Other";


  expenseBudget.value =
    expense.budgetId ||
    "";


  if (
    expenseTrip
  ) {

    expenseTrip.value =
      expense.tripId ||
      "";

  }


  document
    .getElementById(
      "paymentMethod"
    )
    .value =
    expense.paymentMethod ||
    "Cash";


  expenseDate.value =
    expense.date ||
    getTodayString();


  document
    .getElementById(
      "expenseLocation"
    )
    .value =
    expense.location ||
    "";


  document
    .getElementById(
      "expenseNotes"
    )
    .value =
    expense.notes ||
    "";


  currentPhotoData =
    expense.photo ||
    "";


  renderExpensePhotoPreview(
    currentPhotoData
  );


  updateExpenseConversion();

}


// ========================================
// SAVE EXPENSE
// ========================================

expenseForm?.addEventListener(
  "submit",
  async (
    event
  ) => {

    event.preventDefault();


    if (
      photoProcessingPromise
    ) {

      try {

        await photoProcessingPromise;

      } catch (
        error
      ) {

        console.error(
          "Photo processing error:",
          error
        );

      }

    }


    const selectedBudget =
      budgets.find(
        (budget) =>
          budget.id ===
          expenseBudget.value
      );


    const selectedTrip =
      trips.find(
        (trip) =>
          trip.id ===
          expenseTrip?.value
      );


    const existingId =
      expenseIdInput?.value ||
      editingExpenseId;


    const previous =
      expenses.find(
        (item) =>
          item.id ===
          existingId
      );


    const expense = {

      id:
        existingId ||
        generateId(
          "expense"
        ),

      type:
        "expense",

      title:
        document
          .getElementById(
            "expenseTitle"
          )
          .value
          .trim(),

      amount:
        Number(
          amountInput.value
        ),

      currency:
        currencySelect.value,

      category:
        expenseCategory.value,

      budgetId:
        selectedBudget?.id ||
        "",

      budgetName:
        selectedBudget?.name ||
        "",

      paymentMethod:
        document
          .getElementById(
            "paymentMethod"
          )
          .value,

      date:
        expenseDate.value,

      location:
        document
          .getElementById(
            "expenseLocation"
          )
          .value
          .trim(),

      notes:
        document
          .getElementById(
            "expenseNotes"
          )
          .value
          .trim(),

      photo:
        currentPhotoData,

      tripId:
        selectedTrip?.id ||
        "",

      createdAt:
        previous?.createdAt ||
        new Date()
          .toISOString(),

      updatedAt:
        new Date()
          .toISOString()

    };


    await putRecord(
      STORES.expenses,
      expense
    );


    if (
      pendingPlannedConversionId
    ) {

      const planned =
        plannedExpenses.find(
          (item) =>
            item.id ===
            pendingPlannedConversionId
        );


      if (
        planned
      ) {

        await putRecord(
          STORES.planned,
          {
            ...planned,

            status:
              "purchased",

            convertedExpenseId:
              expense.id,

            purchasedAt:
              new Date()
                .toISOString(),

            updatedAt:
              new Date()
                .toISOString()
          }
        );

      }


      pendingPlannedConversionId =
        "";

    }


    await loadAppData();


    const wasEditing =
      Boolean(
        existingId
      );


    resetExpenseForm();


    renderAll();


    showToast(
      wasEditing
        ? "Expense updated ✨"
        : "Expense saved ✨"
    );


    setTimeout(
      () => {

        showScreen(
          "home"
        );

      },
      250
    );

  }
);


document
  .getElementById(
    "saveExpenseTop"
  )
  ?.addEventListener(
    "click",
    () => {

      expenseForm
        ?.requestSubmit();

    }
  );


// ========================================
// TRANSACTION RENDERING
// ========================================

function renderTransaction(
  expense,
  showActions =
    false
) {

  const convertedPHP =
    convertCurrency(
      expense.amount,
      expense.currency,
      "PHP"
    );


  const converted =
    expense.currency !==
    "PHP"

      ? `≈ ${formatPHP(
          convertedPHP
        )}`

      : "";


  const thumbnail =
    expense.photo

      ? `

          <img
            src="${expense.photo}"
            alt=""
          >

        `

      : getCategoryEmoji(
          expense.category
        );


  return `

    <article
      class="transaction-row transaction-row-openable"
      data-expense-detail-id="${escapeHTML(
        expense.id
      )}"
      tabindex="0"
      aria-label="View ${escapeHTML(
        expense.title
      )} expense details"
    >

      <div class="thumb">

        ${thumbnail}

      </div>


      <div class="transaction-main">

        <strong>

          ${escapeHTML(
            expense.title
          )}

        </strong>


        <span>

          ${escapeHTML(
            expense.category
          )}

          •

          ${escapeHTML(
            expense.paymentMethod
          )}

        </span>


        ${
          showActions

            ? `

              <div class="budget-actions">

                <button
                  class="tiny-icon-btn edit-expense"
                  type="button"
                  data-expense-id="${escapeHTML(
                    expense.id
                  )}"
                  aria-label="Edit expense"
                >
                  ✎
                </button>

                <button
                  class="tiny-icon-btn delete-expense"
                  type="button"
                  data-expense-id="${escapeHTML(
                    expense.id
                  )}"
                  aria-label="Delete expense"
                >
                  🗑
                </button>

              </div>

            `

            : ""
        }

      </div>


      <div class="transaction-value">

        <strong>

          ${formatCurrency(
            expense.amount,
            expense.currency
          )}

        </strong>


        ${
          converted

            ? `

              <span>

                ${converted}

              </span>

            `

            : ""
        }

      </div>

    </article>

  `;

}


// ========================================
// ACTIVITY SEARCH + FILTERS
// ========================================

const activitySearch =
  document.getElementById("activitySearch");

const activityCategoryFilter =
  document.getElementById("activityCategoryFilter");

const activityTripFilter =
  document.getElementById("activityTripFilter");

const activityPaymentFilter =
  document.getElementById("activityPaymentFilter");

const activityDateFrom =
  document.getElementById("activityDateFrom");

const activityDateTo =
  document.getElementById("activityDateTo");

const activityFilteredTotal =
  document.getElementById("activityFilteredTotal");

const activityResultCount =
  document.getElementById("activityResultCount");


function populateActivityFilters() {

  const preserveSelect =
    (
      select,
      options,
      firstLabel
    ) => {

      if (!select) return;

      const current =
        select.value;

      select.innerHTML =
        `<option value="">${firstLabel}</option>` +
        options.join("");

      const exists =
        Array.from(select.options)
          .some(
            (option) =>
              option.value === current
          );

      if (exists) {
        select.value = current;
      }

    };


  const categories =
    [...new Set(
      expenses
        .map((expense) => expense.category)
        .filter(Boolean)
    )].sort();


  preserveSelect(
    activityCategoryFilter,
    categories.map(
      (category) =>
        `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`
    ),
    "All categories"
  );


  preserveSelect(
    activityTripFilter,
    [
      `<option value="__personal__">Personal / No Trip</option>`,
      ...trips.map(
        (trip) =>
          `<option value="${escapeHTML(trip.id)}">${escapeHTML(trip.name)}</option>`
      )
    ],
    "All trips"
  );


  const methods =
    [...new Set(
      expenses
        .map((expense) => expense.paymentMethod)
        .filter(Boolean)
    )].sort();


  preserveSelect(
    activityPaymentFilter,
    methods.map(
      (method) =>
        `<option value="${escapeHTML(method)}">${escapeHTML(method)}</option>`
    ),
    "All payment methods"
  );

}


function getFilteredActivityExpenses() {

  const search =
    activitySearch?.value
      .trim()
      .toLowerCase() || "";

  const category =
    activityCategoryFilter?.value || "";

  const tripId =
    activityTripFilter?.value || "";

  const paymentMethod =
    activityPaymentFilter?.value || "";

  const dateFrom =
    activityDateFrom?.value || "";

  const dateTo =
    activityDateTo?.value || "";


  return expenses.filter(
    (expense) => {

      if (search) {

        const searchable =
          [
            expense.title,
            expense.location,
            expense.notes,
            expense.category,
            expense.paymentMethod,
            expense.currency
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        if (!searchable.includes(search)) {
          return false;
        }

      }


      if (
        category &&
        expense.category !== category
      ) {
        return false;
      }


      if (tripId) {

        if (
          tripId === "__personal__"
        ) {

          if (expense.tripId) {
            return false;
          }

        } else if (
          expense.tripId !== tripId
        ) {
          return false;
        }

      }


      if (
        paymentMethod &&
        expense.paymentMethod !== paymentMethod
      ) {
        return false;
      }


      if (
        dateFrom &&
        expense.date < dateFrom
      ) {
        return false;
      }


      if (
        dateTo &&
        expense.date > dateTo
      ) {
        return false;
      }


      return true;

    }
  );

}


function updateActivityFilteredSummary(
  filteredExpenses
) {

  if (activityResultCount) {

    activityResultCount.textContent =
      `${filteredExpenses.length} ${
        filteredExpenses.length === 1
          ? "expense"
          : "expenses"
      }`;

  }


  if (activityFilteredTotal) {

    const total =
      filteredExpenses.reduce(
        (sum, expense) =>
          sum +
          convertToPHP(
            expense.amount,
            expense.currency
          ),
        0
      );

    activityFilteredTotal.textContent =
      formatPHP(total);

  }

}


function renderActivityTransactions() {

  const activity =
    document.getElementById("activityList");

  const empty =
    document.getElementById("activityEmpty");

  if (!activity || !empty) return;


  populateActivityFilters();


  const filtered =
    getFilteredActivityExpenses();


  updateActivityFilteredSummary(
    filtered
  );


  if (filtered.length === 0) {

    activity.innerHTML = "";

    empty.hidden = false;

    const title =
      empty.querySelector("h3");

    const copy =
      empty.querySelector("p");

    if (title) {
      title.textContent =
        expenses.length
          ? "No matching expenses"
          : "No expenses yet";
    }

    if (copy) {
      copy.textContent =
        expenses.length
          ? "Try changing or clearing your filters."
          : "Add your first expense and it will appear here.";
    }

    return;

  }


  empty.hidden = true;


  activity.innerHTML =
    filtered
      .map(
        (expense) =>
          renderTransaction(
            expense,
            true
          )
      )
      .join("");


  attachExpenseActions();

}


[
  activitySearch,
  activityCategoryFilter,
  activityTripFilter,
  activityPaymentFilter,
  activityDateFrom,
  activityDateTo
]
  .filter(Boolean)
  .forEach(
    (control) => {

      control.addEventListener(
        control === activitySearch
          ? "input"
          : "change",
        renderActivityTransactions
      );

    }
  );


document
  .getElementById("clearActivityFilters")
  ?.addEventListener(
    "click",
    () => {

      [
        activitySearch,
        activityCategoryFilter,
        activityTripFilter,
        activityPaymentFilter,
        activityDateFrom,
        activityDateTo
      ]
        .filter(Boolean)
        .forEach(
          (control) => {
            control.value = "";
          }
        );


      renderActivityTransactions();

    }
  );


// ========================================
// RENDER TRANSACTIONS
// ========================================

function renderTransactions() {

  const home =
    document.getElementById(
      "homeTransactionList"
    );


  const activity =
    document.getElementById(
      "activityList"
    );


  const empty =
    document.getElementById(
      "activityEmpty"
    );


  if (
    expenses.length ===
    0
  ) {

    if (
      home
    ) {

      home.innerHTML = `

        <div class="empty-panel compact-empty">

          <span class="empty-icon">
            🍑
          </span>

          <h3>
            No spending yet
          </h3>

          <p>
            Your first expense will appear here.
          </p>

        </div>

      `;

    }


    if (
      activity
    ) {

      activity.innerHTML =
        "";

    }


    updateActivityFilteredSummary(
      []
    );


    if (
      empty
    ) {

      empty.hidden =
        false;

    }


    return;

  }


  if (
    empty
  ) {

    empty.hidden =
      true;

  }


  if (
    home
  ) {

    home.innerHTML =
      expenses

        .slice(
          0,
          4
        )

        .map(
          renderTransaction
        )

        .join("");


    attachExpenseDetailActions();

  }


  if (
    activity
  ) {

    renderActivityTransactions();

  }

}






// ========================================
// EXPENSE DETAIL VIEW
// ========================================

const expenseDetailModal =
  document.getElementById(
    "expenseDetailModal"
  );


const expenseDetailBody =
  document.getElementById(
    "expenseDetailBody"
  );


function getExpenseBudgetName(
  expense
) {

  if (
    !expense?.budgetId
  ) {

    return "No budget";

  }


  const budget =
    budgets.find(
      (item) =>
        item.id ===
        expense.budgetId
    );


  return (
    budget?.name ||
    "No budget"
  );

}


function getExpenseTripName(
  expense
) {

  if (
    !expense?.tripId
  ) {

    return "Personal / No Trip";

  }


  const trip =
    trips.find(
      (item) =>
        item.id ===
        expense.tripId
    );


  return (
    trip?.name ||
    "Trip unavailable"
  );

}


function createExpenseDetailRow(
  label,
  value
) {

  return `

    <div class="expense-detail-row">

      <span>
        ${escapeHTML(
          label
        )}
      </span>

      <strong>
        ${escapeHTML(
          value ||
          "—"
        )}
      </strong>

    </div>

  `;

}


function openExpenseDetail(
  expense
) {

  if (
    !expense ||
    !expenseDetailModal ||
    !expenseDetailBody
  ) {

    return;

  }


  selectedExpenseDetailId =
    expense.id;


  const convertedPHP =
    convertCurrency(
      expense.amount,
      expense.currency,
      "PHP"
    );


  const convertedText =
    expense.currency !==
    "PHP"

      ? `≈ ${formatPHP(
          convertedPHP
        )}`

      : "";


  const photoHTML =
    expense.photo

      ? `

          <div class="expense-detail-photo">

            <img
              src="${expense.photo}"
              alt="${escapeHTML(
                expense.title
              )}"
            >

          </div>

        `

      : `

          <div class="expense-detail-photo expense-detail-photo-empty">

            <span>
              ${getCategoryEmoji(
                expense.category
              )}
            </span>

          </div>

        `;


  expenseDetailBody.innerHTML = `

    ${photoHTML}


    <div class="expense-detail-hero">

      <div>

        <p class="expense-detail-category">

          ${escapeHTML(
            expense.category ||
            "Other"
          )}

        </p>


        <h3>

          ${escapeHTML(
            expense.title ||
            "Expense"
          )}

        </h3>

      </div>


      <div class="expense-detail-amount">

        <strong>

          ${formatCurrency(
            expense.amount,
            expense.currency
          )}

        </strong>


        ${
          convertedText

            ? `

                <span>

                  ${convertedText}

                </span>

              `

            : ""
        }

      </div>

    </div>


    <div class="expense-detail-info">

      ${createExpenseDetailRow(
        "Date",
        formatDate(
          expense.date
        )
      )}

      ${createExpenseDetailRow(
        "Payment",
        expense.paymentMethod
      )}

      ${createExpenseDetailRow(
        "Budget",
        getExpenseBudgetName(
          expense
        )
      )}

      ${createExpenseDetailRow(
        "Trip",
        getExpenseTripName(
          expense
        )
      )}

      ${createExpenseDetailRow(
        "Location / Store",
        expense.location
      )}

    </div>


    ${
      expense.notes

        ? `

            <div class="expense-detail-notes">

              <span>
                Notes
              </span>

              <p>

                ${escapeHTML(
                  expense.notes
                )}

              </p>

            </div>

          `

        : ""
    }

  `;


  expenseDetailModal.hidden =
    false;

}


function closeExpenseDetail() {

  if (
    expenseDetailModal
  ) {

    expenseDetailModal.hidden =
      true;

  }


  selectedExpenseDetailId =
    "";

}


function attachExpenseDetailActions() {

  document
    .querySelectorAll(
      "[data-expense-detail-id]"
    )
    .forEach(
      (row) => {

        if (
          row.dataset
            .detailBound ===
          "yes"
        ) {

          return;

        }


        row.dataset
          .detailBound =
          "yes";


        const openFromRow =
          (event) => {

            if (
              event.target.closest(
                "button"
              )
            ) {

              return;

            }


            const expense =
              expenses.find(
                (item) =>
                  item.id ===
                  row.dataset
                    .expenseDetailId
              );


            if (
              expense
            ) {

              openExpenseDetail(
                expense
              );

            }

          };


        row.addEventListener(
          "click",
          openFromRow
        );


        row.addEventListener(
          "keydown",
          (event) => {

            if (
              event.key !==
              "Enter" &&
              event.key !==
              " "
            ) {

              return;

            }


            if (
              event.target.closest(
                "button"
              )
            ) {

              return;

            }


            event.preventDefault();


            openFromRow(
              event
            );

          }
        );

      }
    );

}


document
  .getElementById(
    "closeExpenseDetail"
  )
  ?.addEventListener(
    "click",
    closeExpenseDetail
  );


expenseDetailModal?.addEventListener(
  "click",
  (event) => {

    if (
      event.target ===
      expenseDetailModal
    ) {

      closeExpenseDetail();

    }

  }
);


document
  .getElementById(
    "editExpenseFromDetail"
  )
  ?.addEventListener(
    "click",
    () => {

      const expense =
        expenses.find(
          (item) =>
            item.id ===
            selectedExpenseDetailId
        );


      if (
        !expense
      ) {

        return;

      }


      closeExpenseDetail();


      openExpenseEditor(
        expense
      );

    }
  );


document
  .getElementById(
    "deleteExpenseFromDetail"
  )
  ?.addEventListener(
    "click",
    () => {

      if (
        !selectedExpenseDetailId
      ) {

        return;

      }


      expensePendingDelete =
        selectedExpenseDetailId;


      closeExpenseDetail();


      document
        .getElementById(
          "deleteExpenseModal"
        )
        .hidden =
        false;

    }
  );


// ========================================
// EDIT / DELETE EXPENSES
// ========================================

function attachExpenseActions() {

  document
    .querySelectorAll(
      ".edit-expense"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const expense =
              expenses.find(
                (item) =>
                  item.id ===
                  button.dataset
                    .expenseId
              );


            if (
              expense
            ) {

              openExpenseEditor(
                expense
              );

            }

          }
        );

      }
    );


  document
    .querySelectorAll(
      ".delete-expense"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            expensePendingDelete =
              button.dataset
                .expenseId;


            document
              .getElementById(
                "deleteExpenseModal"
              )
              .hidden =
              false;

          }
        );

      }
    );

}


document
  .getElementById(
    "cancelDeleteExpense"
  )
  ?.addEventListener(
    "click",
    () => {

      expensePendingDelete =
        null;


      document
        .getElementById(
          "deleteExpenseModal"
        )
        .hidden =
        true;

    }
  );


document
  .getElementById(
    "confirmDeleteExpense"
  )
  ?.addEventListener(
    "click",
    async () => {

      if (
        !expensePendingDelete
      ) {

        return;

      }


      await deleteRecord(
        STORES.expenses,
        expensePendingDelete
      );


      expensePendingDelete =
        null;


      document
        .getElementById(
          "deleteExpenseModal"
        )
        .hidden =
        true;


      await loadAppData();


      renderAll();


      showToast(
        "Expense deleted"
      );

    }
  );


document
  .getElementById(
    "deleteExpenseModal"
  )
  ?.addEventListener(
    "click",
    (event) => {

      if (
        event.target.id ===
        "deleteExpenseModal"
      ) {

        expensePendingDelete =
          null;


        event.currentTarget.hidden =
          true;

      }

    }
  );

// ========================================
// MONTHLY SPENDING
// ========================================

function isCurrentMonth(
  expense
) {

  if (
    !expense.date
  ) {

    return false;

  }


  const date =
    createLocalDate(
      expense.date
    );


  const today =
    new Date();


  return (

    date.getFullYear() ===
      today.getFullYear() &&

    date.getMonth() ===
      today.getMonth()

  );

}


function getMonthlySpent() {

  return expenses

    .filter(
      isCurrentMonth
    )

    .reduce(
      (
        total,
        expense
      ) => {

        return (
          total +
          convertCurrency(
            expense.amount,
            expense.currency,
            "PHP"
          )
        );

      },
      0
    );

}


// ========================================
// MONTHLY BUDGET TOTAL
// ========================================

function getCurrentMonthlyBudgetTotal() {

  return budgets

    .filter(
      (budget) =>

        budget.period ===
          "monthly" &&

        budget.currency ===
          "PHP"
    )

    .reduce(
      (
        total,
        budget
      ) => {

        return (
          total +
          Number(
            budget.amount ||
            0
          )
        );

      },
      0
    );

}


// ========================================
// HOME SUMMARY
// ========================================

function renderHomeSummary() {

  const spent =
    getMonthlySpent();


  const monthlyBudget =
    getCurrentMonthlyBudgetTotal();


  const hasBudget =
    monthlyBudget >
    0;


  const remaining =
    hasBudget

      ? Math.max(
          monthlyBudget -
          spent,
          0
        )

      : null;


  const percent =
    hasBudget

      ? Math.min(
          (
            spent /
            monthlyBudget
          ) *
            100,
          100
        )

      : 0;


  const setText =
    (
      id,
      value
    ) => {

      const element =
        document.getElementById(
          id
        );


      if (
        element
      ) {

        element.textContent =
          value;

      }

    };


  setText(
    "homeSpent",
    formatPHP(
      spent
    )
  );


  setText(
    "activityMonthTotal",
    formatPHP(
      spent
    )
  );


  if (
    hasBudget
  ) {

    setText(
      "homeBudget",
      formatPHP(
        monthlyBudget
      )
    );


    setText(
      "homeRemaining",
      formatPHP(
        remaining
      )
    );


    setText(
      "budgetPageTotal",
      formatPHP(
        monthlyBudget
      )
    );


    setText(
      "budgetPageRemaining",
      formatPHP(
        remaining
      )
    );


    setText(
      "budgetPercent",
      `${Math.round(
        percent
      )}%`
    );

  } else {

    setText(
      "homeBudget",
      "Not set"
    );


    setText(
      "homeRemaining",
      "—"
    );


    setText(
      "budgetPageTotal",
      "Not set"
    );


    setText(
      "budgetPageRemaining",
      "—"
    );


    setText(
      "budgetPercent",
      "—"
    );

  }


  const progress =
    document.getElementById(
      "homeProgress"
    );


  if (
    progress
  ) {

    progress.style.width =
      `${percent}%`;

  }


  const ring =
    document.getElementById(
      "budgetRing"
    );


  if (
    ring
  ) {

    ring.style.background = `

      radial-gradient(
        circle,
        white 55%,
        transparent 57%
      ),

      conic-gradient(
        var(--pink)
        0 ${percent}%,
        #f9e8e4
        ${percent}% 100%
      )

    `;

  }

}


// ========================================
// REPORTS 2.0
// ========================================

let reportPeriod =
  "this_month";


let reportScope =
  "all";


const reportDateFrom =
  document.getElementById(
    "reportDateFrom"
  );


const reportDateTo =
  document.getElementById(
    "reportDateTo"
  );


const reportCustomDates =
  document.getElementById(
    "reportCustomDates"
  );


const reportTripPickerWrap =
  document.getElementById(
    "reportTripPickerWrap"
  );


const reportTripPicker =
  document.getElementById(
    "reportTripPicker"
  );


function dateToKey(
  date
) {

  const year =
    date.getFullYear();


  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );


  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );


  return `${year}-${month}-${day}`;

}


function getReportDateRange() {

  const today =
    new Date();


  const year =
    today.getFullYear();


  const month =
    today.getMonth();


  if (
    reportPeriod ===
    "last_month"
  ) {

    const start =
      new Date(
        year,
        month - 1,
        1
      );


    const end =
      new Date(
        year,
        month,
        0
      );


    return {
      start:
        dateToKey(
          start
        ),

      end:
        dateToKey(
          end
        ),

      label:
        new Intl.DateTimeFormat(
          "en-US",
          {
            month:
              "long",

            year:
              "numeric"
          }
        ).format(
          start
        )
    };

  }


  if (
    reportPeriod ===
    "this_year"
  ) {

    return {
      start:
        `${year}-01-01`,

      end:
        getTodayString(),

      label:
        String(
          year
        )
    };

  }


  if (
    reportPeriod ===
    "custom"
  ) {

    const from =
      reportDateFrom?.value ||
      "";


    const to =
      reportDateTo?.value ||
      "";


    return {
      start:
        from,

      end:
        to,

      label:
        from &&
        to

          ? `${formatShortDate(
              from
            )} – ${formatShortDate(
              to
            )}`

          : "Custom"
    };

  }


  return {
    start:
      `${year}-${String(
        month + 1
      ).padStart(
        2,
        "0"
      )}-01`,

    end:
      getTodayString(),

    label:
      new Intl.DateTimeFormat(
        "en-US",
        {
          month:
            "long",

          year:
            "numeric"
        }
      ).format(
        today
      )
  };

}


function getReportRangeDayCount(
  range
) {

  if (
    !range.start ||
    !range.end
  ) {

    return 0;

  }


  const start =
    createLocalDate(
      range.start
    );


  const end =
    createLocalDate(
      range.end
    );


  if (
    !start ||
    !end ||
    end <
    start
  ) {

    return 0;

  }


  return (
    Math.floor(
      (
        end -
        start
      ) /
      86400000
    ) +
    1
  );

}


function populateReportTripPicker() {

  if (
    !reportTripPicker
  ) {

    return;

  }


  const current =
    reportTripPicker.value;


  reportTripPicker.innerHTML = `

    <option value="">
      Choose a trip
    </option>

    ${trips

      .map(
        (trip) => `

          <option
            value="${escapeHTML(
              trip.id
            )}"
          >
            ${escapeHTML(
              trip.name
            )}
          </option>

        `
      )

      .join("")}

  `;


  if (
    current &&
    trips.some(
      (trip) =>
        trip.id ===
        current
    )
  ) {

    reportTripPicker.value =
      current;

  } else if (
    reportScope ===
      "trip" &&
    trips.length
  ) {

    reportTripPicker.value =
      trips[
        0
      ].id;

  }

}


function getReportExpenses() {

  const range =
    getReportDateRange();


  if (
    !range.start ||
    !range.end ||
    range.end <
      range.start
  ) {

    return [];

  }


  const selectedTripId =
    reportTripPicker?.value ||
    "";


  return expenses.filter(
    (expense) => {

      const date =
        expense.date ||
        (
          expense.createdAt
            ? expense.createdAt.slice(
                0,
                10
              )
            : ""
        );


      if (
        !date ||
        date <
          range.start ||
        date >
          range.end
      ) {

        return false;

      }


      if (
        reportScope ===
        "personal"
      ) {

        return !expense.tripId;

      }


      if (
        reportScope ===
        "trip"
      ) {

        return (
          Boolean(
            selectedTripId
          ) &&
          expense.tripId ===
            selectedTripId
        );

      }


      return true;

    }
  );

}


function sumExpensesPHP(
  items
) {

  return items.reduce(
    (
      total,
      expense
    ) => {

      return (
        total +
        convertCurrency(
          expense.amount,
          expense.currency,
          "PHP"
        )
      );

    },
    0
  );

}


function groupReportExpenses(
  items,
  keyGetter
) {

  const groups =
    new Map();


  items.forEach(
    (expense) => {

      const key =
        keyGetter(
          expense
        ) ||
        "Other";


      const amount =
        convertCurrency(
          expense.amount,
          expense.currency,
          "PHP"
        );


      groups.set(
        key,
        (
          groups.get(
            key
          ) ||
          0
        ) +
        amount
      );

    }
  );


  return Array.from(
    groups.entries()
  )

    .map(
      (
        [
          label,
          amount
        ]
      ) => ({
        label,
        amount
      })
    )

    .sort(
      (
        a,
        b
      ) =>
        b.amount -
        a.amount
    );

}


function renderReportBars(
  container,
  groups,
  total
) {

  if (
    !container
  ) {

    return;

  }


  if (
    groups.length ===
    0
  ) {

    container.innerHTML = `

      <div class="report-mini-empty">
        Nothing to break down yet.
      </div>

    `;


    return;

  }


  container.innerHTML =
    groups

      .map(
        (
          group,
          index
        ) => {

          const percent =
            total >
            0

              ? (
                  group.amount /
                  total
                ) *
                100

              : 0;


          return `

            <div class="report-bar-item">

              <div class="report-bar-top">

                <div class="report-bar-label">

                  <span class="report-bar-rank">
                    ${index + 1}
                  </span>

                  <strong>
                    ${escapeHTML(
                      group.label
                    )}
                  </strong>

                </div>


                <div class="report-bar-value">

                  <strong>
                    ${formatPHP(
                      group.amount
                    )}
                  </strong>

                  <span>
                    ${percent.toFixed(
                      percent >=
                      10
                        ? 0
                        : 1
                    )}%
                  </span>

                </div>

              </div>


              <div class="report-bar-track">

                <div
                  class="report-bar-fill"
                  style="width:${Math.min(
                    percent,
                    100
                  )}%"
                ></div>

              </div>

            </div>

          `;

        }
      )

      .join("");

}


function getReportScopeFilteredExpenses(
  sourceExpenses
) {

  const selectedTripId =
    reportTripPicker?.value ||
    "";


  return sourceExpenses.filter(
    (expense) => {

      if (
        reportScope ===
        "personal"
      ) {

        return !expense.tripId;

      }


      if (
        reportScope ===
        "trip"
      ) {

        return (
          Boolean(
            selectedTripId
          ) &&
          expense.tripId ===
            selectedTripId
        );

      }


      return true;

    }
  );

}


function getLastSixMonths() {

  const today =
    new Date();


  const months =
    [];


  for (
    let offset = 5;
    offset >= 0;
    offset--
  ) {

    const date =
      new Date(
        today.getFullYear(),
        today.getMonth() -
          offset,
        1
      );


    months.push({
      key:
        `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(
          2,
          "0"
        )}`,

      label:
        new Intl.DateTimeFormat(
          "en-US",
          {
            month:
              "short"
          }
        ).format(
          date
        )
    });

  }


  return months;

}


function renderReportTrend() {

  const container =
    document.getElementById(
      "reportMonthlyTrend"
    );


  if (
    !container
  ) {

    return;

  }


  const scopedExpenses =
    getReportScopeFilteredExpenses(
      expenses
    );


  const months =
    getLastSixMonths();


  const data =
    months.map(
      (month) => {

        const monthExpenses =
          scopedExpenses.filter(
            (expense) => {

              const date =
                expense.date ||
                (
                  expense.createdAt
                    ? expense.createdAt.slice(
                        0,
                        10
                      )
                    : ""
                );


              return date.startsWith(
                month.key
              );

            }
          );


        return {
          ...month,

          total:
            sumExpensesPHP(
              monthExpenses
            )
        };

      }
    );


  const maximum =
    Math.max(
      ...data.map(
        (item) =>
          item.total
      ),
      0
    );


  container.innerHTML =
    data

      .map(
        (item) => {

          const height =
            maximum >
            0

              ? Math.max(
                  (
                    item.total /
                    maximum
                  ) *
                    100,
                  item.total >
                    0
                    ? 8
                    : 0
                )

              : 0;


          return `

            <div class="report-trend-column">

              <div class="report-trend-value">
                ${item.total >
                  0
                    ? formatCalendarDayTotal(
                        item.total
                      )
                    : ""}
              </div>

              <div class="report-trend-track">

                <div
                  class="report-trend-fill"
                  style="height:${height}%"
                ></div>

              </div>

              <span>
                ${escapeHTML(
                  item.label
                )}
              </span>

            </div>

          `;

        }
      )

      .join("");

}


function renderReportSummary() {

  populateReportTripPicker();


  if (
    reportCustomDates
  ) {

    reportCustomDates.hidden =
      reportPeriod !==
      "custom";

  }


  if (
    reportTripPickerWrap
  ) {

    reportTripPickerWrap.hidden =
      reportScope !==
      "trip";

  }


  const range =
    getReportDateRange();


  const reportExpenses =
    getReportExpenses();


  const total =
    sumExpensesPHP(
      reportExpenses
    );


  const dayCount =
    getReportRangeDayCount(
      range
    );


  const averageDaily =
    dayCount >
    0

      ? total /
        dayCount

      : 0;


  const biggest =
    reportExpenses

      .map(
        (expense) => ({
          expense,

          amountPHP:
            convertCurrency(
              expense.amount,
              expense.currency,
              "PHP"
            )
        })
      )

      .sort(
        (
          a,
          b
        ) =>
          b.amountPHP -
          a.amountPHP
      )[
        0
      ];


  const setText =
    (
      id,
      value
    ) => {

      const element =
        document.getElementById(
          id
        );


      if (
        element
      ) {

        element.textContent =
          value;

      }

    };


  setText(
    "reportTotalSpending",
    formatPHP(
      total
    )
  );


  setText(
    "reportExpenseCount",
    String(
      reportExpenses.length
    )
  );


  setText(
    "reportAverageDaily",
    formatPHP(
      averageDaily
    )
  );


  setText(
    "reportDaysLabel",
    `${dayCount} ${
      dayCount ===
      1
        ? "day"
        : "days"
    }`
  );


  setText(
    "reportBiggestExpense",
    biggest
      ? formatPHP(
          biggest.amountPHP
        )
      : "₱0.00"
  );


  setText(
    "reportBiggestExpenseTitle",
    biggest
      ? biggest.expense.title ||
        "Expense"
      : "No expenses yet"
  );


  setText(
    "reportPeriodLabel",
    range.label
  );


  const categoryGroups =
    groupReportExpenses(
      reportExpenses,
      (expense) =>
        expense.category ||
        "Other"
    );


  const paymentGroups =
    groupReportExpenses(
      reportExpenses,
      (expense) =>
        expense.paymentMethod ||
        "Other"
    );


  setText(
    "reportCategoryCount",
    `${categoryGroups.length} ${
      categoryGroups.length ===
      1
        ? "category"
        : "categories"
    }`
  );


  renderReportBars(
    document.getElementById(
      "reportCategoryBreakdown"
    ),
    categoryGroups,
    total
  );


  renderReportBars(
    document.getElementById(
      "reportPaymentBreakdown"
    ),
    paymentGroups,
    total
  );


  renderReportTrend();


  const emptyState =
    document.getElementById(
      "reportEmptyState"
    );


  if (
    emptyState
  ) {

    emptyState.hidden =
      reportExpenses.length !==
      0;

  }

}


document
  .querySelectorAll(
    "[data-report-period]"
  )
  .forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          reportPeriod =
            button.dataset
              .reportPeriod;


          document
            .querySelectorAll(
              "[data-report-period]"
            )
            .forEach(
              (item) =>
                item.classList.toggle(
                  "active",
                  item ===
                    button
                )
            );


          if (
            reportPeriod ===
            "custom"
          ) {

            const today =
              getTodayString();


            if (
              reportDateFrom &&
              !reportDateFrom.value
            ) {

              reportDateFrom.value =
                today.slice(
                  0,
                  8
                ) +
                "01";

            }


            if (
              reportDateTo &&
              !reportDateTo.value
            ) {

              reportDateTo.value =
                today;

            }

          }


          renderReportSummary();

        }
      );

    }
  );


document
  .querySelectorAll(
    "[data-report-scope]"
  )
  .forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          reportScope =
            button.dataset
              .reportScope;


          document
            .querySelectorAll(
              "[data-report-scope]"
            )
            .forEach(
              (item) =>
                item.classList.toggle(
                  "active",
                  item ===
                    button
                )
            );


          renderReportSummary();

        }
      );

    }
  );


[
  reportDateFrom,
  reportDateTo,
  reportTripPicker
]

  .filter(
    Boolean
  )

  .forEach(
    (control) => {

      control.addEventListener(
        "change",
        () => {

          renderReportSummary();

        }
      );

    }
  );


// ========================================
// TOAST
// ========================================

const toast =
  document.getElementById(
    "toast"
  );


let toastTimer;


function showToast(
  message
) {

  if (
    !toast
  ) {

    return;

  }


  toast.textContent =
    message;


  toast.classList.add(
    "show"
  );


  clearTimeout(
    toastTimer
  );


  toastTimer =
    setTimeout(
      () => {

        toast.classList.remove(
          "show"
        );

      },
      1800
    );

}



// ========================================
// CALENDAR
// ========================================

const calendarMonthLabel =
  document.getElementById("calendarMonthLabel");

const calendarGrid =
  document.getElementById("calendarGrid");

const calendarDayDetails =
  document.getElementById("calendarDayDetails");

let calendarCursor =
  new Date();

let selectedCalendarDate =
  getTodayString();


function getCalendarMonthKey(
  date
) {

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;

}


function getExpenseDateKey(
  expense
) {

  return (
    expense.date ||
    (
      expense.createdAt
        ? expense.createdAt.slice(0, 10)
        : ""
    )
  );

}


function getExpensesForDate(
  dateKey
) {

  return expenses.filter(
    (expense) =>
      getExpenseDateKey(expense) ===
      dateKey
  );

}


function getDateExpenseTotalPHP(
  dateKey
) {

  return getExpensesForDate(
    dateKey
  ).reduce(
    (total, expense) =>
      total +
      convertCurrency(
        expense.amount,
        expense.currency,
        "PHP"
      ),
    0
  );

}


function formatCalendarDayTotal(
  amount
) {

  const value =
    Number(amount || 0);


  if (
    value >=
    1000000
  ) {

    return `₱${(
      value /
      1000000
    ).toFixed(
      value >=
      10000000
        ? 0
        : 1
    )}m`;

  }


  if (
    value >=
    1000
  ) {

    return `₱${(
      value /
      1000
    ).toFixed(
      value >=
      10000
        ? 0
        : 1
    )}k`;

  }


  return (
    value >
    0
      ? `₱${Math.round(value)}`
      : ""
  );

}


function getTripsForDate(
  dateKey
) {

  return trips.filter(
    (trip) =>
      trip.startDate &&
      trip.endDate &&
      dateKey >=
        trip.startDate &&
      dateKey <=
        trip.endDate
  );

}


function renderCalendarDayDetails(
  dateKey
) {

  if (
    !calendarDayDetails
  ) {

    return;

  }


  selectedCalendarDate =
    dateKey;


  const date =
    createLocalDate(dateKey);


  const dayExpenses =
    getExpensesForDate(dateKey);


  const total =
    getDateExpenseTotalPHP(dateKey);


  const dateTitle =
    new Intl.DateTimeFormat(
      "en-US",
      {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
      }
    ).format(date);


  const activeTrips =
    getTripsForDate(dateKey);


  calendarDayDetails.innerHTML = `

    <div class="calendar-detail-heading">

      <div>

        <p class="eyebrow">
          Selected day
        </p>

        <h2>
          ${escapeHTML(dateTitle)}
        </h2>

      </div>

      <div class="calendar-detail-total">

        <span>Total</span>

        <strong>
          ${formatPHP(total)}
        </strong>

      </div>

    </div>

    ${
      activeTrips.length

        ? `

            <div class="calendar-trip-pills">

              ${activeTrips
                .map(
                  (trip) => `
                    <span>
                      ✈ ${escapeHTML(trip.name)}
                    </span>
                  `
                )
                .join("")}

            </div>

          `

        : ""
    }

    ${
      dayExpenses.length

        ? `

            <div class="calendar-expense-list">

              ${dayExpenses
                .map(
                  (expense) =>
                    renderTransaction(
                      expense,
                      false
                    )
                )
                .join("")}

            </div>

          `

        : `

            <div class="calendar-empty-day">

              <span>🌸</span>

              <strong>
                No spending recorded
              </strong>

              <p>
                A quiet money day.
              </p>

            </div>

          `
    }

  `;


  attachExpenseDetailActions();

}


function renderCalendar() {

  if (
    !calendarGrid ||
    !calendarMonthLabel
  ) {

    return;

  }


  const year =
    calendarCursor.getFullYear();

  const month =
    calendarCursor.getMonth();


  calendarMonthLabel.textContent =
    new Intl.DateTimeFormat(
      "en-US",
      {
        month: "long",
        year: "numeric"
      }
    ).format(calendarCursor);


  const firstDay =
    new Date(
      year,
      month,
      1
    );

  const lastDay =
    new Date(
      year,
      month + 1,
      0
    );

  const leadingDays =
    firstDay.getDay();

  const daysInMonth =
    lastDay.getDate();

  const today =
    getTodayString();

  const monthKey =
    getCalendarMonthKey(
      calendarCursor
    );


  if (
    !selectedCalendarDate.startsWith(
      monthKey
    )
  ) {

    selectedCalendarDate =
      `${monthKey}-01`;

  }


  let cells =
    "";


  for (
    let index = 0;
    index < leadingDays;
    index++
  ) {

    cells += `
      <div
        class="calendar-cell calendar-cell-empty"
        aria-hidden="true"
      ></div>
    `;

  }


  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {

    const dateKey =
      `${monthKey}-${String(day).padStart(
        2,
        "0"
      )}`;


    const dailyTotal =
      getDateExpenseTotalPHP(
        dateKey
      );


    const dayExpenses =
      getExpensesForDate(
        dateKey
      );


    const activeTrips =
      getTripsForDate(
        dateKey
      );


    cells += `

      <button
        class="calendar-cell
          ${dailyTotal > 0 ? "has-spending" : ""}
          ${dateKey === today ? "is-today" : ""}
          ${dateKey === selectedCalendarDate ? "is-selected" : ""}"
        type="button"
        data-calendar-date="${dateKey}"
      >

        <span class="calendar-day-number">
          ${day}
        </span>

        ${
          dailyTotal > 0
            ? `
                <span class="calendar-day-total">
                  ${formatCalendarDayTotal(dailyTotal)}
                </span>
              `
            : ""
        }

        <span class="calendar-day-markers">

          ${
            activeTrips.length
              ? `<i>✈</i>`
              : ""
          }

          ${
            dayExpenses.length
              ? `<b></b>`
              : ""
          }

        </span>

      </button>

    `;

  }


  calendarGrid.innerHTML =
    cells;


  calendarGrid
    .querySelectorAll(
      "[data-calendar-date]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            selectedCalendarDate =
              button.dataset
                .calendarDate;


            renderCalendar();

          }
        );

      }
    );


  renderCalendarDayDetails(
    selectedCalendarDate
  );

}


document
  .getElementById(
    "calendarPreviousMonth"
  )
  ?.addEventListener(
    "click",
    () => {

      calendarCursor =
        new Date(
          calendarCursor.getFullYear(),
          calendarCursor.getMonth() - 1,
          1
        );


      selectedCalendarDate =
        `${getCalendarMonthKey(
          calendarCursor
        )}-01`;


      renderCalendar();

    }
  );


document
  .getElementById(
    "calendarNextMonth"
  )
  ?.addEventListener(
    "click",
    () => {

      calendarCursor =
        new Date(
          calendarCursor.getFullYear(),
          calendarCursor.getMonth() + 1,
          1
        );


      selectedCalendarDate =
        `${getCalendarMonthKey(
          calendarCursor
        )}-01`;


      renderCalendar();

    }
  );


document
  .getElementById(
    "calendarToday"
  )
  ?.addEventListener(
    "click",
    () => {

      calendarCursor =
        new Date();


      selectedCalendarDate =
        getTodayString();


      renderCalendar();

    }
  );



// ========================================
// RECURRING EXPENSES
// ========================================

const recurringModal =
  document.getElementById(
    "recurringModal"
  );


const recurringForm =
  document.getElementById(
    "recurringForm"
  );


const recurringId =
  document.getElementById(
    "recurringId"
  );


const recurringName =
  document.getElementById(
    "recurringName"
  );


const recurringAmount =
  document.getElementById(
    "recurringAmount"
  );


const recurringCurrency =
  document.getElementById(
    "recurringCurrency"
  );


const recurringCategory =
  document.getElementById(
    "recurringCategory"
  );


const recurringPaymentMethod =
  document.getElementById(
    "recurringPaymentMethod"
  );


const recurringFrequency =
  document.getElementById(
    "recurringFrequency"
  );


const recurringNextDueDate =
  document.getElementById(
    "recurringNextDueDate"
  );


const recurringEndDate =
  document.getElementById(
    "recurringEndDate"
  );


const recurringNotes =
  document.getElementById(
    "recurringNotes"
  );


function getDaysInMonth(
  year,
  monthIndex
) {

  return new Date(
    year,
    monthIndex + 1,
    0
  ).getDate();

}


function addMonthsClamped(
  dateString,
  months
) {

  const date =
    createLocalDate(
      dateString
    );


  if (
    !date
  ) {

    return "";

  }


  const originalDay =
    date.getDate();


  const targetMonthStart =
    new Date(
      date.getFullYear(),
      date.getMonth() + months,
      1
    );


  const day =
    Math.min(
      originalDay,
      getDaysInMonth(
        targetMonthStart.getFullYear(),
        targetMonthStart.getMonth()
      )
    );


  const next =
    new Date(
      targetMonthStart.getFullYear(),
      targetMonthStart.getMonth(),
      day
    );


  const year =
    next.getFullYear();


  const month =
    String(
      next.getMonth() + 1
    ).padStart(
      2,
      "0"
    );


  const dateDay =
    String(
      next.getDate()
    ).padStart(
      2,
      "0"
    );


  return `${year}-${month}-${dateDay}`;

}


function addDaysToDateString(
  dateString,
  days
) {

  const date =
    createLocalDate(
      dateString
    );


  if (
    !date
  ) {

    return "";

  }


  date.setDate(
    date.getDate() +
    days
  );


  const year =
    date.getFullYear();


  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );


  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );


  return `${year}-${month}-${day}`;

}


function getNextRecurringDate(
  dateString,
  frequency
) {

  switch (
    frequency
  ) {

    case "weekly":
      return addDaysToDateString(
        dateString,
        7
      );


    case "quarterly":
      return addMonthsClamped(
        dateString,
        3
      );


    case "yearly":
      return addMonthsClamped(
        dateString,
        12
      );


    case "monthly":
    default:
      return addMonthsClamped(
        dateString,
        1
      );

  }

}


function getRecurringFrequencyLabel(
  frequency
) {

  const labels = {

    weekly:
      "Weekly",

    monthly:
      "Monthly",

    quarterly:
      "Quarterly",

    yearly:
      "Yearly"

  };


  return (
    labels[
      frequency
    ] ||
    "Monthly"
  );

}


function isRecurringActive(
  recurring
) {

  if (
    recurring.active ===
    false
  ) {

    return false;

  }


  if (
    recurring.endDate &&
    recurring.nextDueDate >
      recurring.endDate
  ) {

    return false;

  }


  return true;

}


function getRecurringStatus(
  recurring
) {

  if (
    !isRecurringActive(
      recurring
    )
  ) {

    return {
      label:
        "Ended",

      className:
        "ended"
    };

  }


  const today =
    getTodayString();


  if (
    recurring.nextDueDate <
    today
  ) {

    return {
      label:
        "Overdue",

      className:
        "overdue"
    };

  }


  const sevenDaysFromToday =
    addDaysToDateString(
      today,
      7
    );


  if (
    recurring.nextDueDate <=
    sevenDaysFromToday
  ) {

    return {
      label:
        "Due soon",

      className:
        "due-soon"
    };

  }


  return {
    label:
      "Upcoming",

    className:
      "upcoming"
  };

}


function getRecurringMonthlyFactor(
  frequency
) {

  switch (
    frequency
  ) {

    case "weekly":
      return 52 / 12;


    case "quarterly":
      return 1 / 3;


    case "yearly":
      return 1 / 12;


    case "monthly":
    default:
      return 1;

  }

}


function getRecurringMonthlyEstimatePHP() {

  return recurringExpenses.reduce(
    (
      total,
      recurring
    ) => {

      if (
        !isRecurringActive(
          recurring
        )
      ) {

        return total;

      }


      const amountPHP =
        convertCurrency(
          recurring.amount,
          recurring.currency,
          "PHP"
        );


      return (
        total +
        amountPHP *
        getRecurringMonthlyFactor(
          recurring.frequency
        )
      );

    },
    0
  );

}


function openRecurringModal(
  recurring =
    null
) {

  if (
    !recurringModal ||
    !recurringForm
  ) {

    return;

  }


  recurringModal.hidden =
    false;


  if (
    recurring
  ) {

    document
      .getElementById(
        "recurringModalTitle"
      )
      .textContent =
      "Edit Recurring Expense";


    recurringId.value =
      recurring.id;


    recurringName.value =
      recurring.name ||
      "";


    recurringAmount.value =
      recurring.amount ??
      "";


    recurringCurrency.value =
      recurring.currency ||
      "PHP";


    recurringCategory.value =
      recurring.category ||
      "Bills";


    recurringPaymentMethod.value =
      recurring.paymentMethod ||
      "Credit Card";


    recurringFrequency.value =
      recurring.frequency ||
      "monthly";


    recurringNextDueDate.value =
      recurring.nextDueDate ||
      getTodayString();


    recurringEndDate.value =
      recurring.endDate ||
      "";


    recurringNotes.value =
      recurring.notes ||
      "";

  } else {

    recurringForm.reset();


    document
      .getElementById(
        "recurringModalTitle"
      )
      .textContent =
      "Add Recurring Expense";


    recurringId.value =
      "";


    recurringCurrency.value =
      "PHP";


    recurringCategory.value =
      "Bills";


    recurringPaymentMethod.value =
      "Credit Card";


    recurringFrequency.value =
      "monthly";


    recurringNextDueDate.value =
      getTodayString();


    recurringEndDate.value =
      "";

  }

}


function closeRecurringModal() {

  if (
    recurringModal
  ) {

    recurringModal.hidden =
      true;

  }

}


document
  .getElementById(
    "addRecurringButton"
  )
  ?.addEventListener(
    "click",
    () => {

      openRecurringModal();

    }
  );


document
  .getElementById(
    "closeRecurringModal"
  )
  ?.addEventListener(
    "click",
    closeRecurringModal
  );


recurringModal?.addEventListener(
  "click",
  (event) => {

    if (
      event.target ===
      recurringModal
    ) {

      closeRecurringModal();

    }

  }
);


recurringForm?.addEventListener(
  "submit",
  async (
    event
  ) => {

    event.preventDefault();


    if (
      recurringEndDate.value &&
      recurringEndDate.value <
        recurringNextDueDate.value
    ) {

      showToast(
        "End date can't be before the next due date."
      );


      return;

    }


    const existingId =
      recurringId.value;


    const previous =
      recurringExpenses.find(
        (item) =>
          item.id ===
          existingId
      );


    const recurring = {

      id:
        existingId ||
        generateId(
          "recurring"
        ),

      name:
        recurringName.value
          .trim(),

      amount:
        Number(
          recurringAmount.value
        ),

      currency:
        recurringCurrency.value,

      category:
        recurringCategory.value,

      paymentMethod:
        recurringPaymentMethod.value,

      frequency:
        recurringFrequency.value,

      nextDueDate:
        recurringNextDueDate.value,

      endDate:
        recurringEndDate.value,

      notes:
        recurringNotes.value
          .trim(),

      active:
        previous?.active ??
        true,

      createdAt:
        previous?.createdAt ||
        new Date()
          .toISOString(),

      updatedAt:
        new Date()
          .toISOString()

    };


    await putRecord(
      STORES.recurring,
      recurring
    );


    await loadAppData();


    closeRecurringModal();


    renderAll();


    showToast(
      existingId
        ? "Recurring expense updated ✨"
        : "Recurring expense added ↻"
    );

  }
);


function createRecurringCardHTML(
  recurring
) {

  const status =
    getRecurringStatus(
      recurring
    );


  return `

    <article class="recurring-card">

      <div class="recurring-card-top">

        <div class="recurring-icon">
          ${getCategoryEmoji(
            recurring.category
          )}
        </div>


        <div class="recurring-card-copy">

          <div class="recurring-title-row">

            <h3>
              ${escapeHTML(
                recurring.name
              )}
            </h3>

            <span
              class="recurring-status ${status.className}"
            >
              ${escapeHTML(
                status.label
              )}
            </span>

          </div>


          <p>
            ${escapeHTML(
              recurring.category
            )}
            ·
            ${escapeHTML(
              recurring.paymentMethod
            )}
          </p>

        </div>

      </div>


      <div class="recurring-amount-row">

        <div>

          <span>
            Amount
          </span>

          <strong>
            ${formatCurrency(
              recurring.amount,
              recurring.currency
            )}
          </strong>

        </div>


        <div>

          <span>
            Frequency
          </span>

          <strong>
            ${escapeHTML(
              getRecurringFrequencyLabel(
                recurring.frequency
              )
            )}
          </strong>

        </div>


        <div>

          <span>
            Next due
          </span>

          <strong>
            ${formatShortDate(
              recurring.nextDueDate
            )}
          </strong>

        </div>

      </div>


      ${
        recurring.notes

          ? `

              <p class="recurring-notes">
                ${escapeHTML(
                  recurring.notes
                )}
              </p>

            `

          : ""
      }


      <div class="recurring-card-actions">

        <button
          class="secondary-btn log-recurring-expense"
          type="button"
          data-recurring-id="${escapeHTML(
            recurring.id
          )}"
          ${!isRecurringActive(recurring)
            ? "disabled"
            : ""}
        >
          ＋ Log Expense
        </button>


        <button
          class="tiny-icon-btn edit-recurring"
          type="button"
          data-recurring-id="${escapeHTML(
            recurring.id
          )}"
          aria-label="Edit recurring expense"
        >
          ✎
        </button>


        <button
          class="tiny-icon-btn delete-recurring"
          type="button"
          data-recurring-id="${escapeHTML(
            recurring.id
          )}"
          aria-label="Delete recurring expense"
        >
          🗑
        </button>

      </div>

    </article>

  `;

}


function renderRecurringExpenses() {

  const list =
    document.getElementById(
      "recurringList"
    );


  const empty =
    document.getElementById(
      "recurringEmpty"
    );


  if (
    !list ||
    !empty
  ) {

    return;

  }


  const sorted =
    [...recurringExpenses]
      .sort(
        (
          a,
          b
        ) => {

          return (
            String(
              a.nextDueDate ||
              ""
            ).localeCompare(
              String(
                b.nextDueDate ||
                ""
              )
            )
          );

        }
      );


  const active =
    sorted.filter(
      isRecurringActive
    );


  const today =
    getTodayString();


  const dueSoonLimit =
    addDaysToDateString(
      today,
      7
    );


  const dueSoon =
    active.filter(
      (recurring) =>
        recurring.nextDueDate <=
          dueSoonLimit
    );


  const activeCount =
    document.getElementById(
      "recurringActiveCount"
    );


  const dueSoonCount =
    document.getElementById(
      "recurringDueSoonCount"
    );


  const monthlyEstimate =
    document.getElementById(
      "recurringMonthlyEstimate"
    );


  if (
    activeCount
  ) {

    activeCount.textContent =
      String(
        active.length
      );

  }


  if (
    dueSoonCount
  ) {

    dueSoonCount.textContent =
      String(
        dueSoon.length
      );

  }


  if (
    monthlyEstimate
  ) {

    monthlyEstimate.textContent =
      formatPHP(
        getRecurringMonthlyEstimatePHP()
      );

  }


  if (
    sorted.length ===
    0
  ) {

    list.innerHTML =
      "";


    empty.style.display =
      "block";


    return;

  }


  empty.style.display =
    "none";


  list.innerHTML =
    sorted

      .map(
        createRecurringCardHTML
      )

      .join("");


  attachRecurringActions();

}


function attachRecurringActions() {

  document
    .querySelectorAll(
      ".edit-recurring"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const recurring =
              recurringExpenses.find(
                (item) =>
                  item.id ===
                  button.dataset
                    .recurringId
              );


            if (
              recurring
            ) {

              openRecurringModal(
                recurring
              );

            }

          }
        );

      }
    );


  document
    .querySelectorAll(
      ".delete-recurring"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            recurringPendingDelete =
              button.dataset
                .recurringId;


            document
              .getElementById(
                "deleteRecurringModal"
              )
              .hidden =
              false;

          }
        );

      }
    );


  document
    .querySelectorAll(
      ".log-recurring-expense"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          async () => {

            const recurring =
              recurringExpenses.find(
                (item) =>
                  item.id ===
                  button.dataset
                    .recurringId
              );


            if (
              !recurring ||
              !isRecurringActive(
                recurring
              )
            ) {

              return;

            }


            const expense = {

              id:
                generateId(
                  "expense"
                ),

              title:
                recurring.name,

              amount:
                Number(
                  recurring.amount ||
                  0
                ),

              currency:
                recurring.currency,

              category:
                recurring.category,

              budgetId:
                "",

              budgetName:
                "",

              paymentMethod:
                recurring.paymentMethod,

              date:
                getTodayString(),

              location:
                "",

              notes:
                recurring.notes ||
                "",

              photo:
                "",

              tripId:
                "",

              sourceRecurringId:
                recurring.id,

              createdAt:
                new Date()
                  .toISOString(),

              updatedAt:
                new Date()
                  .toISOString()

            };


            await putRecord(
              STORES.expenses,
              expense
            );


            const nextDate =
              getNextRecurringDate(
                recurring.nextDueDate,
                recurring.frequency
              );


            const updatedRecurring = {
              ...recurring,

              nextDueDate:
                nextDate,

              active:
                !(
                  recurring.endDate &&
                  nextDate >
                    recurring.endDate
                ),

              updatedAt:
                new Date()
                  .toISOString()
            };


            await putRecord(
              STORES.recurring,
              updatedRecurring
            );


            await loadAppData();


            renderAll();


            showToast(
              "Expense logged and next due date updated ✨"
            );

          }
        );

      }
    );

}


document
  .getElementById(
    "cancelDeleteRecurring"
  )
  ?.addEventListener(
    "click",
    () => {

      recurringPendingDelete =
        null;


      document
        .getElementById(
          "deleteRecurringModal"
        )
        .hidden =
        true;

    }
  );


document
  .getElementById(
    "confirmDeleteRecurring"
  )
  ?.addEventListener(
    "click",
    async () => {

      if (
        !recurringPendingDelete
      ) {

        return;

      }


      await deleteRecord(
        STORES.recurring,
        recurringPendingDelete
      );


      recurringPendingDelete =
        null;


      document
        .getElementById(
          "deleteRecurringModal"
        )
        .hidden =
        true;


      await loadAppData();


      renderAll();


      showToast(
        "Recurring expense deleted"
      );

    }
  );


document
  .getElementById(
    "deleteRecurringModal"
  )
  ?.addEventListener(
    "click",
    (event) => {

      if (
        event.target.id ===
        "deleteRecurringModal"
      ) {

        recurringPendingDelete =
          null;


        event.currentTarget.hidden =
          true;

      }

    }
  );




// ========================================
// PLANNED EXPENSES
// ========================================

let plannedExpenseFilter =
  "planned";


const plannedExpenseModal =
  document.getElementById(
    "plannedExpenseModal"
  );


const plannedExpenseForm =
  document.getElementById(
    "plannedExpenseForm"
  );


const plannedExpenseId =
  document.getElementById(
    "plannedExpenseId"
  );


const plannedExpenseTitle =
  document.getElementById(
    "plannedExpenseTitle"
  );


const plannedExpenseAmount =
  document.getElementById(
    "plannedExpenseAmount"
  );


const plannedExpenseCurrency =
  document.getElementById(
    "plannedExpenseCurrency"
  );


const plannedExpenseCategory =
  document.getElementById(
    "plannedExpenseCategory"
  );


const plannedExpenseTrip =
  document.getElementById(
    "plannedExpenseTrip"
  );


const plannedExpenseTargetDate =
  document.getElementById(
    "plannedExpenseTargetDate"
  );


const plannedExpenseNotes =
  document.getElementById(
    "plannedExpenseNotes"
  );


function populatePlannedTripDropdown() {

  if (
    !plannedExpenseTrip
  ) {

    return;

  }


  const current =
    plannedExpenseTrip.value;


  plannedExpenseTrip.innerHTML = `

    <option value="">
      Personal / No Trip
    </option>

    ${trips

      .map(
        (trip) => `

          <option
            value="${escapeHTML(
              trip.id
            )}"
          >
            ${escapeHTML(
              trip.name
            )}
          </option>

        `
      )

      .join("")}

  `;


  if (
    current &&
    trips.some(
      (trip) =>
        trip.id ===
        current
    )
  ) {

    plannedExpenseTrip.value =
      current;

  }

}


function openPlannedExpenseModal(
  planned =
    null
) {

  if (
    !plannedExpenseModal ||
    !plannedExpenseForm
  ) {

    return;

  }


  populatePlannedTripDropdown();


  plannedExpenseModal.hidden =
    false;


  if (
    planned
  ) {

    document
      .getElementById(
        "plannedExpenseModalTitle"
      )
      .textContent =
      "Edit Planned Expense";


    plannedExpenseId.value =
      planned.id;


    plannedExpenseTitle.value =
      planned.title ||
      "";


    plannedExpenseAmount.value =
      planned.amount ??
      "";


    plannedExpenseCurrency.value =
      planned.currency ||
      "PHP";


    plannedExpenseCategory.value =
      planned.category ||
      "Shopping";


    plannedExpenseTrip.value =
      planned.tripId ||
      "";


    plannedExpenseTargetDate.value =
      planned.targetDate ||
      "";


    plannedExpenseNotes.value =
      planned.notes ||
      "";

  } else {

    plannedExpenseForm.reset();


    document
      .getElementById(
        "plannedExpenseModalTitle"
      )
      .textContent =
      "Add Planned Expense";


    plannedExpenseId.value =
      "";


    plannedExpenseCurrency.value =
      "PHP";


    plannedExpenseCategory.value =
      "Shopping";


    plannedExpenseTrip.value =
      "";

  }

}


function closePlannedExpenseModal() {

  if (
    plannedExpenseModal
  ) {

    plannedExpenseModal.hidden =
      true;

  }

}


document
  .getElementById(
    "addPlannedExpenseButton"
  )
  ?.addEventListener(
    "click",
    () => {

      openPlannedExpenseModal();

    }
  );


document
  .getElementById(
    "closePlannedExpenseModal"
  )
  ?.addEventListener(
    "click",
    closePlannedExpenseModal
  );


plannedExpenseModal?.addEventListener(
  "click",
  (event) => {

    if (
      event.target ===
      plannedExpenseModal
    ) {

      closePlannedExpenseModal();

    }

  }
);


plannedExpenseForm?.addEventListener(
  "submit",
  async (
    event
  ) => {

    event.preventDefault();


    const existingId =
      plannedExpenseId.value;


    const previous =
      plannedExpenses.find(
        (item) =>
          item.id ===
          existingId
      );


    const planned = {

      id:
        existingId ||
        generateId(
          "planned"
        ),

      title:
        plannedExpenseTitle.value
          .trim(),

      amount:
        Number(
          plannedExpenseAmount.value
        ),

      currency:
        plannedExpenseCurrency.value,

      category:
        plannedExpenseCategory.value,

      tripId:
        plannedExpenseTrip.value,

      targetDate:
        plannedExpenseTargetDate.value,

      notes:
        plannedExpenseNotes.value
          .trim(),

      status:
        previous?.status ||
        "planned",

      convertedExpenseId:
        previous?.convertedExpenseId ||
        "",

      purchasedAt:
        previous?.purchasedAt ||
        "",

      createdAt:
        previous?.createdAt ||
        new Date()
          .toISOString(),

      updatedAt:
        new Date()
          .toISOString()

    };


    await putRecord(
      STORES.planned,
      planned
    );


    await loadAppData();


    closePlannedExpenseModal();


    renderAll();


    showToast(
      existingId
        ? "Planned expense updated ✨"
        : "Planned expense added ☆"
    );

  }
);


function getPlannedTripName(
  planned
) {

  if (
    !planned.tripId
  ) {

    return "Personal";

  }


  const trip =
    trips.find(
      (item) =>
        item.id ===
        planned.tripId
    );


  return (
    trip?.name ||
    "Trip"
  );

}


function getPlannedTotalPHP() {

  return plannedExpenses

    .filter(
      (item) =>
        item.status ===
        "planned"
    )

    .reduce(
      (
        total,
        item
      ) => {

        return (
          total +
          convertCurrency(
            item.amount,
            item.currency,
            "PHP"
          )
        );

      },
      0
    );

}


function createPlannedExpenseCardHTML(
  planned
) {

  const isPurchased =
    planned.status ===
    "purchased";


  return `

    <article
      class="planned-expense-card ${
        isPurchased
          ? "is-purchased"
          : ""
      }"
    >

      <div class="planned-expense-top">

        <div class="planned-expense-icon">
          ${getCategoryEmoji(
            planned.category
          )}
        </div>


        <div class="planned-expense-copy">

          <div class="planned-expense-title-row">

            <h3>
              ${escapeHTML(
                planned.title
              )}
            </h3>

            <span
              class="planned-status ${
                isPurchased
                  ? "purchased"
                  : "planned"
              }"
            >
              ${
                isPurchased
                  ? "Purchased"
                  : "Planned"
              }
            </span>

          </div>


          <p>

            ${escapeHTML(
              planned.category
            )}

            ·

            ${escapeHTML(
              getPlannedTripName(
                planned
              )
            )}

          </p>

        </div>

      </div>


      <div class="planned-expense-values">

        <div>

          <span>
            Expected
          </span>

          <strong>
            ${formatCurrency(
              planned.amount,
              planned.currency
            )}
          </strong>

        </div>


        <div>

          <span>
            Target date
          </span>

          <strong>
            ${
              planned.targetDate
                ? formatShortDate(
                    planned.targetDate
                  )
                : "Anytime"
            }
          </strong>

        </div>

      </div>


      ${
        planned.notes

          ? `

              <p class="planned-expense-notes">
                ${escapeHTML(
                  planned.notes
                )}
              </p>

            `

          : ""
      }


      <div class="planned-expense-actions">

        ${
          !isPurchased

            ? `

                <button
                  class="secondary-btn convert-planned-expense"
                  type="button"
                  data-planned-id="${escapeHTML(
                    planned.id
                  )}"
                >
                  ＋ Move to Expense
                </button>

              `

            : `

                <div class="planned-purchased-note">
                  ✓ Added to expenses
                </div>

              `
        }


        <button
          class="tiny-icon-btn edit-planned-expense"
          type="button"
          data-planned-id="${escapeHTML(
            planned.id
          )}"
          aria-label="Edit planned expense"
        >
          ✎
        </button>


        <button
          class="tiny-icon-btn delete-planned-expense"
          type="button"
          data-planned-id="${escapeHTML(
            planned.id
          )}"
          aria-label="Delete planned expense"
        >
          🗑
        </button>

      </div>

    </article>

  `;

}


function renderPlannedExpenses() {

  const list =
    document.getElementById(
      "plannedExpenseList"
    );


  const empty =
    document.getElementById(
      "plannedExpenseEmpty"
    );


  if (
    !list ||
    !empty
  ) {

    return;

  }


  populatePlannedTripDropdown();


  const active =
    plannedExpenses.filter(
      (item) =>
        item.status ===
        "planned"
    );


  const purchased =
    plannedExpenses.filter(
      (item) =>
        item.status ===
        "purchased"
    );


  const totalElement =
    document.getElementById(
      "plannedTotalAmount"
    );


  const activeCount =
    document.getElementById(
      "plannedActiveCount"
    );


  const purchasedCount =
    document.getElementById(
      "plannedPurchasedCount"
    );


  if (
    totalElement
  ) {

    totalElement.textContent =
      formatPHP(
        getPlannedTotalPHP()
      );

  }


  if (
    activeCount
  ) {

    activeCount.textContent =
      `${active.length} ${
        active.length ===
        1
          ? "item"
          : "items"
      }`;

  }


  if (
    purchasedCount
  ) {

    purchasedCount.textContent =
      String(
        purchased.length
      );

  }


  let filtered =
    plannedExpenses;


  if (
    plannedExpenseFilter !==
    "all"
  ) {

    filtered =
      plannedExpenses.filter(
        (item) =>
          item.status ===
          plannedExpenseFilter
      );

  }


  if (
    filtered.length ===
    0
  ) {

    list.innerHTML =
      "";


    empty.style.display =
      "block";


    const title =
      empty.querySelector(
        "h3"
      );


    const copy =
      empty.querySelector(
        "p"
      );


    if (
      title
    ) {

      title.textContent =
        plannedExpenses.length
          ? "Nothing in this view"
          : "No planned expenses yet";

    }


    if (
      copy
    ) {

      copy.textContent =
        plannedExpenses.length
          ? "Try another filter."
          : "Add something you may want to buy later.";

    }


    return;

  }


  empty.style.display =
    "none";


  list.innerHTML =
    filtered

      .map(
        createPlannedExpenseCardHTML
      )

      .join("");


  attachPlannedExpenseActions();

}


document
  .querySelectorAll(
    "[data-planned-filter]"
  )
  .forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          plannedExpenseFilter =
            button.dataset
              .plannedFilter;


          document
            .querySelectorAll(
              "[data-planned-filter]"
            )
            .forEach(
              (item) =>
                item.classList.toggle(
                  "active",
                  item ===
                    button
                )
            );


          renderPlannedExpenses();

        }
      );

    }
  );


function attachPlannedExpenseActions() {

  document
    .querySelectorAll(
      ".edit-planned-expense"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const planned =
              plannedExpenses.find(
                (item) =>
                  item.id ===
                  button.dataset
                    .plannedId
              );


            if (
              planned
            ) {

              openPlannedExpenseModal(
                planned
              );

            }

          }
        );

      }
    );


  document
    .querySelectorAll(
      ".delete-planned-expense"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            plannedPendingDelete =
              button.dataset
                .plannedId;


            document
              .getElementById(
                "deletePlannedExpenseModal"
              )
              .hidden =
              false;

          }
        );

      }
    );


  document
    .querySelectorAll(
      ".convert-planned-expense"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const planned =
              plannedExpenses.find(
                (item) =>
                  item.id ===
                  button.dataset
                    .plannedId
              );


            if (
              !planned
            ) {

              return;

            }


            pendingPlannedConversionId =
              planned.id;


            openingExpenseEditor =
              true;


            showScreen(
              "add"
            );


            resetExpenseForm();


            setExpenseFormMode(
              "add"
            );


            document
              .getElementById(
                "expenseTitle"
              )
              .value =
              planned.title ||
              "";


            amountInput.value =
              planned.amount ??
              "";


            currencySelect.value =
              planned.currency ||
              "PHP";


            expenseCategory.value =
              planned.category ||
              "Shopping";


            if (
              expenseTrip
            ) {

              expenseTrip.value =
                planned.tripId ||
                "";

            }


            document
              .getElementById(
                "expenseNotes"
              )
              .value =
              planned.notes ||
              "";


            expenseDate.value =
              planned.targetDate ||
              getTodayString();


            updateExpenseConversion();


            showToast(
              "Planned item loaded. Add payment details, then save."
            );

          }
        );

      }
    );

}


document
  .getElementById(
    "cancelDeletePlannedExpense"
  )
  ?.addEventListener(
    "click",
    () => {

      plannedPendingDelete =
        null;


      document
        .getElementById(
          "deletePlannedExpenseModal"
        )
        .hidden =
        true;

    }
  );


document
  .getElementById(
    "confirmDeletePlannedExpense"
  )
  ?.addEventListener(
    "click",
    async () => {

      if (
        !plannedPendingDelete
      ) {

        return;

      }


      await deleteRecord(
        STORES.planned,
        plannedPendingDelete
      );


      plannedPendingDelete =
        null;


      document
        .getElementById(
          "deletePlannedExpenseModal"
        )
        .hidden =
        true;


      await loadAppData();


      renderAll();


      showToast(
        "Planned expense deleted"
      );

    }
  );


document
  .getElementById(
    "deletePlannedExpenseModal"
  )
  ?.addEventListener(
    "click",
    (event) => {

      if (
        event.target.id ===
        "deletePlannedExpenseModal"
      ) {

        plannedPendingDelete =
          null;


        event.currentTarget.hidden =
          true;

      }

    }
  );


// ========================================
// BACKUP & EXPORT
// ========================================

const MOMO_BACKUP_FORMAT =
  "momo-backup";


const MOMO_BACKUP_VERSION =
  1;


const importMomoBackupFile =
  document.getElementById(
    "importMomoBackupFile"
  );


const restoreBackupModal =
  document.getElementById(
    "restoreBackupModal"
  );


function formatBackupFileDate(
  date =
    new Date()
) {

  const year =
    date.getFullYear();


  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );


  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );


  const hour =
    String(
      date.getHours()
    ).padStart(
      2,
      "0"
    );


  const minute =
    String(
      date.getMinutes()
    ).padStart(
      2,
      "0"
    );


  return `${year}-${month}-${day}_${hour}-${minute}`;

}


function downloadTextFile(
  filename,
  content,
  mimeType
) {

  const blob =
    new Blob(
      [
        content
      ],
      {
        type:
          mimeType
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const link =
    document.createElement(
      "a"
    );


  link.href =
    url;


  link.download =
    filename;


  document.body.appendChild(
    link
  );


  link.click();


  link.remove();


  setTimeout(
    () => {

      URL.revokeObjectURL(
        url
      );

    },
    1000
  );

}


async function buildMomoBackup() {

  const settings =
    await getAllRecords(
      STORES.settings
    );


  const backup = {

    format:
      MOMO_BACKUP_FORMAT,

    backupVersion:
      MOMO_BACKUP_VERSION,

    databaseVersion:
      DB_VERSION,

    appName:
      "Momo",

    exportedAt:
      new Date()
        .toISOString(),

    data: {

      expenses:
        expenses,

      budgets:
        budgets,

      trips:
        trips,

      cards:
        cards,

      recurringExpenses:
        recurringExpenses,

      plannedExpenses:
        plannedExpenses,

      settings:
        settings

    },

    preferences: {

      converterCurrencyA:
        localStorage.getItem(
          LOCAL_KEYS.converterA
        ) ||
        "",

      converterCurrencyB:
        localStorage.getItem(
          LOCAL_KEYS.converterB
        ) ||
        ""

    }

  };


  return backup;

}


document
  .getElementById(
    "exportMomoBackup"
  )
  ?.addEventListener(
    "click",
    async () => {

      try {

        const backup =
          await buildMomoBackup();


        const json =
          JSON.stringify(
            backup,
            null,
            2
          );


        downloadTextFile(
          `momo-backup-${formatBackupFileDate()}.json`,
          json,
          "application/json"
        );


        showToast(
          "Momo backup exported ✨"
        );

      } catch (
        error
      ) {

        console.error(
          "Backup export failed:",
          error
        );


        showToast(
          "Could not export backup."
        );

      }

    }
  );


function csvEscape(
  value
) {

  if (
    value ===
    null ||
    value ===
    undefined
  ) {

    return "";

  }


  const text =
    String(
      value
    );


  if (
    /[",\n\r]/.test(
      text
    )
  ) {

    return `"${text.replaceAll(
      '"',
      '""'
    )}"`;

  }


  return text;

}


function createExpenseCSV() {

  const headers = [

    "Date",
    "Title",
    "Amount",
    "Currency",
    "PHP Equivalent",
    "Category",
    "Payment Method",
    "Budget",
    "Trip",
    "Location / Store",
    "Notes",
    "Photo Attached",
    "Created At",
    "Updated At"

  ];


  const rows =
    expenses.map(
      (expense) => {

        const phpEquivalent =
          convertCurrency(
            expense.amount,
            expense.currency,
            "PHP"
          );


        return [

          expense.date ||
            "",

          expense.title ||
            "",

          Number(
            expense.amount ||
            0
          ),

          expense.currency ||
            "PHP",

          Number(
            phpEquivalent.toFixed(
              2
            )
          ),

          expense.category ||
            "",

          expense.paymentMethod ||
            "",

          getExpenseBudgetName(
            expense
          ),

          getExpenseTripName(
            expense
          ),

          expense.location ||
            "",

          expense.notes ||
            "",

          expense.photo
            ? "Yes"
            : "No",

          expense.createdAt ||
            "",

          expense.updatedAt ||
            ""

        ];

      }
    );


  return [

    headers,
    ...rows

  ]

    .map(
      (row) =>
        row
          .map(
            csvEscape
          )
          .join(
            ","
          )
    )

    .join(
      "\r\n"
    );

}


document
  .getElementById(
    "exportExpensesCSV"
  )
  ?.addEventListener(
    "click",
    () => {

      if (
        expenses.length ===
        0
      ) {

        showToast(
          "No expenses to export yet."
        );


        return;

      }


      const csv =
        createExpenseCSV();


      downloadTextFile(
        `momo-expenses-${formatBackupFileDate()}.csv`,
        `\uFEFF${csv}`,
        "text/csv;charset=utf-8"
      );


      showToast(
        "Expense CSV exported ✨"
      );

    }
  );


document
  .getElementById(
    "chooseMomoBackup"
  )
  ?.addEventListener(
    "click",
    () => {

      if (
        importMomoBackupFile
      ) {

        importMomoBackupFile.value =
          "";


        importMomoBackupFile.click();

      }

    }
  );


function isPlainObject(
  value
) {

  return (
    value !==
      null &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
  );

}


function validateMomoBackup(
  backup
) {

  if (
    !isPlainObject(
      backup
    )
  ) {

    return {
      valid:
        false,

      message:
        "That file is not a valid Momo backup."
    };

  }


  if (
    backup.format !==
    MOMO_BACKUP_FORMAT
  ) {

    return {
      valid:
        false,

      message:
        "This is not a Momo backup file."
    };

  }


  if (
    Number(
      backup.backupVersion
    ) >
    MOMO_BACKUP_VERSION
  ) {

    return {
      valid:
        false,

      message:
        "This backup was created by a newer Momo backup format."
    };

  }


  if (
    !isPlainObject(
      backup.data
    )
  ) {

    return {
      valid:
        false,

      message:
        "Backup data is missing."
    };

  }


  const requiredArrays = [

    "expenses",
    "budgets",
    "trips",
    "recurringExpenses",
    "plannedExpenses"

  ];


  const invalidArray =
    requiredArrays.find(
      (key) =>
        !Array.isArray(
          backup.data[
            key
          ]
        )
    );


  if (
    invalidArray
  ) {

    return {
      valid:
        false,

      message:
        "The backup is incomplete or damaged."
    };

  }


  return {
    valid:
      true,

    message:
      ""
  };

}


function getBackupRestoreSummaryHTML(
  backup
) {

  const data =
    backup.data;


  const exportedAt =
    backup.exportedAt
      ? new Date(
          backup.exportedAt
        )
      : null;


  const exportedText =
    exportedAt &&
    !Number.isNaN(
      exportedAt.getTime()
    )

      ? new Intl.DateTimeFormat(
          "en-US",
          {
            dateStyle:
              "medium",

            timeStyle:
              "short"
          }
        ).format(
          exportedAt
        )

      : "Unknown";


  return `

    <div class="restore-summary-date">

      <span>
        Backup created
      </span>

      <strong>
        ${escapeHTML(
          exportedText
        )}
      </strong>

    </div>


    <div class="restore-summary-grid">

      <div>
        <strong>
          ${data.expenses.length}
        </strong>
        <span>Expenses</span>
      </div>

      <div>
        <strong>
          ${data.budgets.length}
        </strong>
        <span>Budgets</span>
      </div>

      <div>
        <strong>
          ${data.trips.length}
        </strong>
        <span>Trips</span>
      </div>

      <div>
        <strong>
          ${data.recurringExpenses.length}
        </strong>
        <span>Recurring</span>
      </div>

      <div>
        <strong>
          ${data.plannedExpenses.length}
        </strong>
        <span>Planned</span>
      </div>

    </div>

  `;

}


importMomoBackupFile?.addEventListener(
  "change",
  async () => {

    const file =
      importMomoBackupFile.files?.[
        0
      ];


    if (
      !file
    ) {

      return;

    }


    try {

      const text =
        await file.text();


      const backup =
        JSON.parse(
          text
        );


      const validation =
        validateMomoBackup(
          backup
        );


      if (
        !validation.valid
      ) {

        pendingBackupRestore =
          null;


        showToast(
          validation.message
        );


        return;

      }


      pendingBackupRestore =
        backup;


      const summary =
        document.getElementById(
          "restoreBackupSummary"
        );


      if (
        summary
      ) {

        summary.innerHTML =
          getBackupRestoreSummaryHTML(
            backup
          );

      }


      if (
        restoreBackupModal
      ) {

        restoreBackupModal.hidden =
          false;

      }

    } catch (
      error
    ) {

      console.error(
        "Backup import failed:",
        error
      );


      pendingBackupRestore =
        null;


      showToast(
        "Could not read that backup file."
      );

    }

  }
);


async function restoreRecords(
  storeName,
  records
) {

  await clearStore(
    storeName
  );


  for (
    const record of records
  ) {

    if (
      !isPlainObject(
        record
      )
    ) {

      continue;

    }


    await putRecord(
      storeName,
      record
    );

  }

}


async function restoreMomoBackup(
  backup
) {

  const data =
    backup.data;


  await restoreRecords(
    STORES.expenses,
    data.expenses ||
      []
  );


  await restoreRecords(
    STORES.budgets,
    data.budgets ||
      []
  );


  await restoreRecords(
    STORES.trips,
    data.trips ||
      []
  );


  await restoreRecords(
    STORES.cards,
    Array.isArray(
      data.cards
    )
      ? data.cards
      : []
  );


  await restoreRecords(
    STORES.recurring,
    data.recurringExpenses ||
      []
  );


  await restoreRecords(
    STORES.planned,
    data.plannedExpenses ||
      []
  );


  await restoreRecords(
    STORES.settings,
    Array.isArray(
      data.settings
    )
      ? data.settings
      : []
  );


  const preferences =
    isPlainObject(
      backup.preferences
    )
      ? backup.preferences
      : {};


  if (
    preferences.converterCurrencyA
  ) {

    localStorage.setItem(
      LOCAL_KEYS.converterA,
      preferences.converterCurrencyA
    );

  } else {

    localStorage.removeItem(
      LOCAL_KEYS.converterA
    );

  }


  if (
    preferences.converterCurrencyB
  ) {

    localStorage.setItem(
      LOCAL_KEYS.converterB,
      preferences.converterCurrencyB
    );

  } else {

    localStorage.removeItem(
      LOCAL_KEYS.converterB
    );

  }


  await loadAppData();


  renderAll();


  initializeConverterCurrencies();

}


document
  .getElementById(
    "cancelRestoreBackup"
  )
  ?.addEventListener(
    "click",
    () => {

      pendingBackupRestore =
        null;


      if (
        restoreBackupModal
      ) {

        restoreBackupModal.hidden =
          true;

      }

    }
  );


document
  .getElementById(
    "confirmRestoreBackup"
  )
  ?.addEventListener(
    "click",
    async () => {

      if (
        !pendingBackupRestore
      ) {

        return;

      }


      const restoreButton =
        document.getElementById(
          "confirmRestoreBackup"
        );


      if (
        restoreButton
      ) {

        restoreButton.disabled =
          true;

      }


      try {

        const backup =
          pendingBackupRestore;


        await restoreMomoBackup(
          backup
        );


        pendingBackupRestore =
          null;


        if (
          restoreBackupModal
        ) {

          restoreBackupModal.hidden =
            true;

        }


        renderBackupStatus();


        showToast(
          "Momo backup restored ✨"
        );

      } catch (
        error
      ) {

        console.error(
          "Backup restore failed:",
          error
        );


        showToast(
          "Restore failed. Your backup file was not deleted."
        );

      } finally {

        if (
          restoreButton
        ) {

          restoreButton.disabled =
            false;

        }

      }

    }
  );


restoreBackupModal?.addEventListener(
  "click",
  (event) => {

    if (
      event.target ===
      restoreBackupModal
    ) {

      pendingBackupRestore =
        null;


      restoreBackupModal.hidden =
        true;

    }

  }
);


function renderBackupStatus() {

  const mappings = [

    [
      "backupExpenseCount",
      expenses.length
    ],

    [
      "backupBudgetCount",
      budgets.length
    ],

    [
      "backupTripCount",
      trips.length
    ],

    [
      "backupRecurringCount",
      recurringExpenses.length
    ],

    [
      "backupPlannedCount",
      plannedExpenses.length
    ]

  ];


  mappings.forEach(
    (
      [
        id,
        value
      ]
    ) => {

      const element =
        document.getElementById(
          id
        );


      if (
        element
      ) {

        element.textContent =
          String(
            value
          );

      }

    }
  );

}


// ========================================
// RENDER EVERYTHING
// ========================================

function renderAll() {

  renderBudgets();

  renderTrips();

  renderTransactions();

  renderCalendar();

  renderRecurringExpenses();

  renderPlannedExpenses();

  renderBackupStatus();

  renderHomeSummary();

  renderReportSummary();

}


// ========================================
// ESCAPE KEY
// ========================================

document.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key !==
      "Escape"
    ) {

      return;

    }


    closeDrawer();


    if (
      budgetModal
    ) {

      budgetModal.hidden =
        true;

    }


    if (
      tripModal
    ) {

      tripModal.hidden =
        true;

    }


    const deleteBudgetModal =
      document.getElementById(
        "deleteModal"
      );


    if (
      deleteBudgetModal
    ) {

      deleteBudgetModal.hidden =
        true;

    }


    const deleteTripModal =
      document.getElementById(
        "deleteTripModal"
      );


    if (
      deleteTripModal
    ) {

      deleteTripModal.hidden =
        true;

    }


    closeExpenseDetail();


    const deleteExpenseModal =
      document.getElementById(
        "deleteExpenseModal"
      );


    if (
      deleteExpenseModal
    ) {

      deleteExpenseModal.hidden =
        true;

    }


    if (
      recurringModal
    ) {

      recurringModal.hidden =
        true;

    }


    const deleteRecurringModal =
      document.getElementById(
        "deleteRecurringModal"
      );


    if (
      deleteRecurringModal
    ) {

      deleteRecurringModal.hidden =
        true;

    }


    if (
      restoreBackupModal
    ) {

      restoreBackupModal.hidden =
        true;

    }


    if (
      plannedExpenseModal
    ) {

      plannedExpenseModal.hidden =
        true;

    }


    const deletePlannedExpenseModal =
      document.getElementById(
        "deletePlannedExpenseModal"
      );


    if (
      deletePlannedExpenseModal
    ) {

      deletePlannedExpenseModal.hidden =
        true;

    }


    expensePendingDelete =
      null;


    recurringPendingDelete =
      null;


    pendingBackupRestore =
      null;


    plannedPendingDelete =
      null;

  }
);


// ========================================
// INITIALIZE
// ========================================

async function initializeApp() {

  try {

    await openDatabase();


    await performCleanStartIfNeeded();


    await loadAppData();


    if (
      expenseDate
    ) {

      expenseDate.value =
        getTodayString();

    }


    initializeConverter();


    updateExpenseConversion();


    renderAll();


    console.log(
      "🍑 Momo ready."
    );

  } catch (
    error
  ) {

    console.error(
      "Momo could not initialize:",
      error
    );


    showToast(
      "Momo could not open its local database."
    );

  }

}


initializeApp();
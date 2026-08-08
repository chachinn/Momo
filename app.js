// ========================================
// MOMO
// CLEAN FOUNDATION + FUNCTIONAL TRIPS
// ========================================


// ========================================
// DATABASE
// ========================================

const DB_NAME = "momo_database";

const DB_VERSION = 1;


const STORES = {

  expenses: "expenses",

  budgets: "budgets",

  trips: "trips",

  cards: "cards",

  accounts: "accounts",

  recurring: "recurring",

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

let accounts = [];

let recurringExpenses = [];


let activeBudgetFilter =
  "all";


let budgetPendingDelete =
  null;


let tripPendingDelete =
  null;


let currentPhotoData =
  "";


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


          // ACCOUNTS

          if (
            !database.objectStoreNames.contains(
              STORES.accounts
            )
          ) {

            database.createObjectStore(
              STORES.accounts,
              {
                keyPath: "id"
              }
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
      STORES.accounts
    ),

    clearStore(
      STORES.recurring
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

    accounts,

    recurringExpenses

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
      STORES.accounts
    ),

    getAllRecords(
      STORES.recurring
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

  "wallet"

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

    prepareExpenseForm();

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
    "reports"
  ) {

    renderReportSummary();

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
// WALLET SWITCH
// ========================================

const walletTabs =
  document.getElementById(
    "walletTabs"
  );


walletTabs?.addEventListener(
  "click",
  (event) => {

    const button =
      event.target.closest(
        "[data-wallet-view]"
      );


    if (
      !button
    ) {

      return;

    }


    const view =
      button.dataset
        .walletView;


    walletTabs
      .querySelectorAll(
        ".wallet-switch-btn"
      )
      .forEach(
        (item) => {

          item.classList.toggle(
            "active",
            item ===
              button
          );

        }
      );


    document
      .querySelectorAll(
        ".wallet-view"
      )
      .forEach(
        (panel) => {

          panel.classList.toggle(
            "active",
            panel.dataset
              .walletPanel ===
              view
          );

        }
      );

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
          () => {

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
          () => {

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
    This is already structured for the next update.

    When expenses receive a tripId, Momo will
    automatically calculate spending here.
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


    const reader =
      new FileReader();


    reader.onload =
      () => {

        currentPhotoData =
          reader.result;


        photoPreview.innerHTML = `

          <img
            src="${currentPhotoData}"
            alt="Expense photo"
          >

        `;

      };


    reader.readAsDataURL(
      file
    );

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


function prepareExpenseForm() {

  populateExpenseBudgetDropdown();


  if (
    expenseDate &&
    !expenseDate.value
  ) {

    expenseDate.value =
      getTodayString();

  }

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


    const selectedBudget =
      budgets.find(
        (budget) =>
          budget.id ===
          expenseBudget.value
      );


    const expense = {

      id:
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

      /*
        Trip linking will be added next.
      */

      tripId:
        "",

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


    await loadAppData();


    expenseForm.reset();


    currentPhotoData =
      "";


    photoPreview.innerHTML =
      "📸";


    expenseDate.value =
      getTodayString();


    currencySelect.value =
      "PHP";


    updateExpenseConversion();


    renderAll();


    showToast(
      "Expense saved ✨"
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
  expense
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

    <article class="transaction-row">

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

  }


  if (
    activity
  ) {

    activity.innerHTML =
      expenses

        .map(
          renderTransaction
        )

        .join("");

  }

}


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


  setText(
    "reportMonthTotal",
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
// REPORT SUMMARY
// ========================================

function renderReportSummary() {

  const report =
    document.getElementById(
      "reportMonthTotal"
    );


  if (
    report
  ) {

    report.textContent =
      formatPHP(
        getMonthlySpent()
      );

  }

}


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
// RENDER EVERYTHING
// ========================================

function renderAll() {

  renderBudgets();

  renderTrips();

  renderTransactions();

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
// Quick verification of validation logic
// This is just to verify the regex patterns work correctly

// Phone validation test
const phoneTests = [
  { input: "abc123", shouldFail: true, desc: "alphabetic + numeric" },
  { input: "123!@#", shouldFail: true, desc: "numeric + special" },
  { input: "abc!@#", shouldFail: true, desc: "alphabetic + special" },
  { input: "abc123!@#", shouldFail: true, desc: "all mixed" },
  { input: "1234567890", shouldPass: true, desc: "digits only" },
  { input: "+60123456789", shouldPass: true, desc: "plus at start" },
  { input: "123+456", shouldFail: true, desc: "plus in middle" },
];

console.log("Phone Validation Tests:");
phoneTests.forEach(test => {
  const hasInvalidChars = /[^0-9+]/.test(test.input);
  const hasPlusNotAtStart = test.input.includes('+') && !test.input.startsWith('+');
  const hasMultiplePlus = (test.input.match(/\+/g) || []).length > 1;
  const hasNoDigits = !/[0-9]/.test(test.input);
  const shouldFail = hasInvalidChars || hasPlusNotAtStart || hasMultiplePlus || hasNoDigits;
  
  const result = test.shouldFail ? shouldFail : !shouldFail;
  console.log(`  ${test.desc}: ${result ? '✓' : '✗'} (input: "${test.input}")`);
});

// Password validation test
const passwordTests = [
  { input: "Pass123!", shouldPass: true, desc: "valid password" },
  { input: "pass123!", shouldFail: true, desc: "no uppercase" },
  { input: "PASS123!", shouldFail: true, desc: "no lowercase" },
  { input: "PassWord!", shouldFail: true, desc: "no number" },
  { input: "Pass1234", shouldFail: true, desc: "no special char" },
  { input: "Pass1!", shouldFail: true, desc: "less than 8 chars" },
];

console.log("\nPassword Validation Tests:");
passwordTests.forEach(test => {
  const has8Chars = test.input.length >= 8;
  const hasLower = /[a-z]/.test(test.input);
  const hasUpper = /[A-Z]/.test(test.input);
  const hasNumber = /[0-9]/.test(test.input);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(test.input);
  const isValid = has8Chars && hasLower && hasUpper && hasNumber && hasSpecial;
  
  const result = test.shouldPass ? isValid : !isValid;
  console.log(`  ${test.desc}: ${result ? '✓' : '✗'} (input: "${test.input}")`);
});

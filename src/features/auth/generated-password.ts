const LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const NUMBERS = "23456789";
const SYMBOLS = "!@#$%^&*";
const PASSWORD_LENGTH = 18;

function pick(characters: string, value: number) {
  return characters[value % characters.length];
}

export function generatePassword() {
  const groups = [LOWERCASE, UPPERCASE, NUMBERS, SYMBOLS];
  const allCharacters = groups.join("");
  const randomValues = new Uint32Array(PASSWORD_LENGTH * 2);
  crypto.getRandomValues(randomValues);

  const password = groups.map((group, index) => pick(group, randomValues[index]!));

  for (let index = groups.length; index < PASSWORD_LENGTH; index += 1) {
    password.push(pick(allCharacters, randomValues[index]!));
  }

  for (let index = password.length - 1; index > 0; index -= 1) {
    const swapIndex = randomValues[PASSWORD_LENGTH + index]! % (index + 1);
    const currentCharacter = password[index]!;
    password[index] = password[swapIndex]!;
    password[swapIndex] = currentCharacter;
  }

  return password.join("");
}

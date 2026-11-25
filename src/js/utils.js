export async function loadPartial(selector, file) {

  const container = document.querySelector(selector);

  try {
    const response = await fetch(
      `${import.meta.env.BASE_URL}${file}`
    );

    if (!response.ok) {
      throw new Error(`Cannot load ${file}`);
    }

    const html = await response.text();

    container.innerHTML = html;

  } catch (error) {
    console.error(error);
  }
}
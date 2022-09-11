async function* asyncSubArrayGenerator(
  array: unknown[],
  iterate: number,
  deley = 0
) {
  let i = 0;
  const arrayLength = array.length;
  while (i < arrayLength) {
    if (i && deley > 0)
      await new Promise((resolve) => setTimeout(resolve, deley));

    yield array.slice(i, i + iterate);
    i = i + iterate;
  }
  return [];
}

export { asyncSubArrayGenerator };

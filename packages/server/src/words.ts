const RAW = `
cat, dog, horse, cow, pig, sheep, goat, chicken, duck, goose, rabbit, mouse, rat, squirrel, fox, wolf, bear, lion, tiger, elephant,
giraffe, zebra, monkey, gorilla, kangaroo, koala, panda, penguin, owl, eagle, parrot, swan, flamingo, peacock, frog, turtle,
snake, lizard, crocodile, dinosaur, dolphin, whale, shark, octopus, crab, lobster, fish, jellyfish, starfish, seahorse, butterfly,
bee, ant, spider, snail, worm, ladybug, mosquito, camel, deer, hedgehog, bat, bull, donkey, hippo, rhino, seal, walrus,
apple, banana, orange, lemon, strawberry, cherry, grapes, watermelon, pineapple, pear, peach, coconut, carrot, potato, tomato,
onion, corn, broccoli, mushroom, pumpkin, pizza, burger, hot dog, sandwich, pasta, sushi, taco, pancake, waffle, donut, cookie,
cake, cupcake, ice cream, candy, chocolate, popcorn, pretzel, bread, cheese, egg, bacon, soup, salad, french fries, lollipop,
honey, milk, coffee, tea,
chair, table, bed, lamp, door, window, key, clock, mirror, umbrella, candle, scissors, hammer, saw, ladder, bucket, broom,
toothbrush, soap, towel, pillow, blanket, backpack, suitcase, wallet, glasses, hat, shoe, sock, glove, scarf, crown, ring,
necklace, watch, camera, phone, computer, keyboard, television, radio, headphones, guitar, piano, drum, trumpet, violin,
microphone, book, pencil, pen, paintbrush, calculator, flashlight, battery, magnet, compass, map, flag, balloon, gift, trophy,
medal, bell, lock, rope, anchor, shovel, axe, tent, ball, kite, robot, vase, bottle, cup, fork, spoon, knife, plate, bowl,
teapot, fridge, oven, bathtub, toilet, sink, stairs, fence, bridge,
sun, moon, star, cloud, rain, snow, rainbow, lightning, tornado, volcano, mountain, river, lake, ocean, beach, island, desert,
forest, tree, flower, rose, sunflower, cactus, leaf, grass, rock, cave, waterfall, fire, ice, house, castle, tower, church,
school, hospital, farm, windmill, lighthouse, pyramid, igloo, city, park, garden, playground, circus, zoo, museum, airport, bank,
car, bus, truck, bicycle, motorcycle, train, airplane, helicopter, rocket, boat, ship, submarine, tractor, ambulance, taxi,
scooter, skateboard, hot air balloon, sled, parachute,
sleeping, swimming, running, jumping, dancing, singing, cooking, reading, painting, fishing, climbing, skiing, surfing, laughing,
crying, sneezing, yawning, juggling, knitting, camping, doctor, teacher, pirate, ghost, witch, wizard, fairy, mermaid, dragon,
unicorn, vampire, zombie, alien, astronaut, king, queen, knight, ninja, clown, snowman, scarecrow, skeleton, heart, smile, eye,
nose, ear, tooth, hand, foot, brain, muscle, beard, bone, diamond, treasure
`;

export const WORDS: string[] = Array.from(
  new Set(
    RAW.split(',')
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean),
  ),
);

// Returns `count` random words that are not in `used`.
// If the pool runs low, the used set is reset.
export function pickWords(count: number, used: Set<string>): string[] {
  let pool = WORDS.filter((w) => !used.has(w));
  if (pool.length < count) {
    used.clear();
    pool = [...WORDS];
  }
  const picked: string[] = [];
  while (picked.length < count && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }
  return picked;
}

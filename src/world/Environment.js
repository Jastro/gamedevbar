import { Bar } from './Bar';
import { Furniture } from './Furniture';
import { Radio } from './Radio';
import { Paintings } from './Paintings';
import { Bathroom } from './Bathroom';
import { ArcadePong } from './ArcadePong';
import { ArcadeSnake } from './ArcadeSnake';

export class Environment {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.bar = new Bar(scene);
        this.furniture = new Furniture(scene);
        this.radio = new Radio(scene);
        this.paintings = new Paintings(scene);
        this.bathroom = new Bathroom(scene);
        this.arcadePong = new ArcadePong(scene);
        this.arcadeSnake = new ArcadeSnake(scene);
    }

    create() {
        this.bar.create();
        this.furniture.create();
        this.radio.create();
        this.paintings.create();
        this.arcadeSnake.create({ x: -12, y: 2, z: -8 });
        this.arcadePong.create({ x: -7.5, y: 2, z: -8 });
        this.loadPaintings();
    }

    loadPaintings() {
        const paintingsInfo = this.paintings.getPaintingsInfo();
        paintingsInfo.forEach((painting, index) => {
            const imageUrl = `/paintings/imagen${index + 1}.jpg`;
            this.paintings.loadImage(painting.id, imageUrl);
        });
    }
}
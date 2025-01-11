import { World } from './World';
import { Bar } from './Bar';
import { Furniture } from './Furniture';
import { Radio } from './Radio';
import { Paintings } from './Paintings';
import { Bathroom } from './Bathroom';

export class Environment {
    constructor(scene) {
        this.scene = scene;
        this.world = new World(scene);
        this.bar = new Bar(scene);
        this.furniture = new Furniture(scene);
        this.radio = new Radio(scene);
        this.paintings = new Paintings(scene);
        this.bathroom = new Bathroom(scene);
    }

    create() {
        this.world.create();
        this.bar.create();
        this.furniture.create();
        this.radio.create();
        this.paintings.create();
        //this.bathroom.create();
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
import { STAR_TYPES } from "./stars.js";
import { StarIcon } from "./Star.jsx"

const SLOTS = [[0.35, 0.78], [0.62, 0.78], [0.5, 0.5]];

export default function SmallJar({ src, onGrab, scale = 1 }) {
    return  (
        <div className="jar-wrap jar-small">
            <img src={src} draggable={false} />
            {STAR_TYPES.map((type, i) => (
                <div
                    key={type.minutes}
                    className="dispenser-star"
                    style={{ left: `${SLOTS[i][0] * 100}%`, top: `${SLOTS[i][1] * 100}%` }}
                    onPointerDown={(e) => { e.preventDefault(); onGrab(type, e, 'small'); }}
                >
                    <StarIcon color={type.color} size={type.radius * 2 * scale} />
                    <span>{type.label}</span>
                </div>
            ))}
        </div>    

    )
}
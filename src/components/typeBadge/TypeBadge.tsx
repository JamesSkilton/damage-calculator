import { TypeName } from "calc-runtime/core/data/interface";
import './TypeBadge.scss';

type TypeBadgeProps = {
    type: TypeName;
}

const TypeBadge = ({ type }: TypeBadgeProps) => {

    return (
        <span className={`badge badge-${type.toLowerCase()}`}>{type}</span>
    );
};

export default TypeBadge;
from sqlalchemy import BigInteger, Column, Float, String
from sqlalchemy.orm import DeclarativeBase
from geoalchemy2 import Geometry


class Base(DeclarativeBase):
    pass


class Road(Base):
    __tablename__ = "roads"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    from_node_id = Column(BigInteger, nullable=False, index=True)
    to_node_id = Column(BigInteger, nullable=False, index=True)
    name = Column(String, nullable=True)
    highway_type = Column(String, nullable=True)
    length_m = Column(Float, nullable=True)
    geometry = Column(Geometry(srid=4326), nullable=False)

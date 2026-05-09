from sqlalchemy import BigInteger, Column, DateTime, Float, Index, Integer, String
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


class TrafficLevel(Base):
    __tablename__ = "traffic_levels"
    __table_args__ = (
        Index("idx_traffic_hour_day", "hour", "day_type"),
    )

    road_id = Column(BigInteger, primary_key=True)
    hour = Column(Integer, primary_key=True)
    day_type = Column(String(10), primary_key=True)
    traffic_level = Column(Float, nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

"""Seed a small campus marketplace dataset for local development."""

from decimal import Decimal

from app import models
from app.db import SessionLocal


CATEGORIES = [
    ("二手教材", "textbooks", "book", 1),
    ("数码设备", "digital", "laptop", 2),
    ("宿舍好物", "dorm", "lamp", 3),
    ("游戏交易", "games", "gamepad", 4),
    ("运动出行", "sports", "bike", 5),
]


def seed():
    db = SessionLocal()
    try:
        owner = db.query(models.User).order_by(models.User.id).first()
        if not owner:
            raise RuntimeError("请先注册至少一个用户，再运行种子脚本")

        if db.query(models.Category).count() == 0:
            for name, slug, icon, sort_order in CATEGORIES:
                db.add(models.Category(name=name, slug=slug, icon=icon, sort_order=sort_order))
            db.flush()

        categories = {item.slug: item for item in db.query(models.Category).all()}

        if db.query(models.Listing).count() == 0:
            listings = [
                models.Listing(
                    seller_id=owner.id,
                    category_id=categories["digital"].id,
                    title="平板电脑 11 英寸 深空灰 99 新",
                    description="自用国行，保护到位，带键盘保护套和手写笔，图书馆门口可验机。",
                    price=Decimal("2499"),
                    original_price=Decimal("3299"),
                    condition="like_new",
                    location_name="西区宿舍",
                ),
                models.Listing(
                    seller_id=owner.id,
                    category_id=categories["games"].id,
                    title="机械键盘 68 键 热插拔",
                    description="宿舍升级留下，轴体顺滑无连击，支持当面试用。",
                    price=Decimal("168"),
                    condition="good",
                    trade_type="digital",
                    location_name="东区 3 栋",
                ),
            ]
            db.add_all(listings)
            db.flush()
            db.add_all([
                models.ListingImage(listing_id=listings[0].id, image_url="/marketplace/tablet.png"),
                models.ListingImage(listing_id=listings[1].id, image_url="/marketplace/keyboard.png"),
            ])

        if db.query(models.ServiceTask).count() == 0:
            db.add_all([
                models.ServiceTask(
                    requester_id=owner.id,
                    task_type="express",
                    title="菜鸟驿站取两个小件",
                    description="送到北区宿舍 12 栋。",
                    reward=Decimal("5"),
                    pickup_location="菜鸟驿站",
                    delivery_location="北区宿舍 12 栋",
                    latitude=Decimal("32.0407"),
                    longitude=Decimal("120.8078"),
                ),
                models.ServiceTask(
                    requester_id=owner.id,
                    task_type="takeout",
                    title="西区饭堂三楼拿外卖",
                    reward=Decimal("4"),
                    pickup_location="西区饭堂",
                    delivery_location="东区宿舍 7 栋",
                    latitude=Decimal("32.0421"),
                    longitude=Decimal("120.8106"),
                ),
                models.ServiceTask(
                    requester_id=owner.id,
                    task_type="errand",
                    title="帮买感冒药",
                    reward=Decimal("8"),
                    pickup_location="校医院",
                    delivery_location="同仁堂",
                    latitude=Decimal("32.0395"),
                    longitude=Decimal("120.8120"),
                ),
            ])

        task_coordinates = {
            "菜鸟驿站取两个小件": ("32.0407", "120.8078"),
            "西区饭堂三楼拿外卖": ("32.0421", "120.8106"),
            "帮买感冒药": ("32.0395", "120.8120"),
        }
        for task in db.query(models.ServiceTask).filter(models.ServiceTask.title.in_(task_coordinates)).all():
            latitude, longitude = task_coordinates[task.title]
            task.latitude = Decimal(latitude)
            task.longitude = Decimal(longitude)

        if db.query(models.WantedPost).count() == 0:
            db.add(models.WantedPost(
                user_id=owner.id,
                title="求购《微观经济学》高鸿业第七版",
                description="最好有笔记，不要太旧，价格可聊，本周课程急用。",
                budget_max=Decimal("30"),
                location_name="南通理工学院南通校区",
            ))
        else:
            db.query(models.WantedPost).filter(
                models.WantedPost.title == "求购《微观经济学》高鸿业第七版"
            ).update({"location_name": "南通理工学院南通校区"})

        if db.query(models.CommunityPost).count() == 0:
            db.add(models.CommunityPost(
                author_id=owner.id,
                title="分享一次超治愈的校园日落",
                content="今天操场的晚霞也太美了吧，和室友绕场散步刚好遇见。",
                topic="校园生活",
                image_url="/marketplace/campus-sunset.png",
                like_count=48,
                comment_count=12,
            ))

        db.commit()
        print("校园交易演示数据已写入。")
    finally:
        db.close()


if __name__ == "__main__":
    seed()

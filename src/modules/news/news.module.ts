import { Module } from '@nestjs/common';
import { NewsService } from './news.service';
import {
  NewsPublicController,
  NewsAdminController,
} from './news.controller';

@Module({
  controllers: [
    NewsPublicController, // GET /news, GET /news/categories, GET /news/:slug
    NewsAdminController,  // CRUD /admin/news + PATCH /admin/news/:id/publish
  ],
  providers: [NewsService],
  exports: [NewsService],
})
export class NewsModule {}

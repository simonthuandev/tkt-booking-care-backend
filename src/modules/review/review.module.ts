import { Module } from '@nestjs/common';
import { ReviewService } from './review.service';
import {
  ReviewPublicController,
  ReviewUserController,
  ReviewUserMeController,
  ReviewAdminController,
} from './review.controller';

@Module({
  controllers: [
    ReviewPublicController,  // GET /reviews
    ReviewUserController,    // POST /reviews
    ReviewUserMeController,  // GET /users/me/reviews
    ReviewAdminController,   // GET|PATCH /admin/reviews
  ],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}

import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '@modules/auth/decorators';
import { QuerySearchDto } from './dto/search.dto';
import { SearchService } from './search.service';

@Public()
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async search(@Query() query: QuerySearchDto) {
    const result = await this.searchService.search(query);
    return {
      message: 'Tìm kiếm thành công',
      ...result,
    };
  }
}

